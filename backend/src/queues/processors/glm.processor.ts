import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { GlmService, Agent, RoomContext } from '../../glm/glm.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { PrismaClient } from '@prisma/client';
import { RedisService } from '../../redis/redis.service';

export interface GlmRequestJob {
  type: 'generate_agent_response';
  agentId: string;
  agent: Agent;
  roomContext: RoomContext;
  triggerMessage: string;
}

@Processor('glm-requests', {
  concurrency: 5,
})
export class GlmProcessor extends WorkerHost {
  private readonly logger = new Logger(GlmProcessor.name);
  private prisma: PrismaClient;

  // Rate limit configuration for agent messages
  private readonly AGENT_MESSAGE_RATE_LIMIT = parseInt(process.env.AGENT_MESSAGE_RATE_LIMIT || '10');
  private readonly AGENT_MESSAGE_RATE_WINDOW = parseInt(process.env.AGENT_MESSAGE_RATE_WINDOW || '60'); // 1 minute

  constructor(
    private readonly glmService: GlmService,
    @Inject(forwardRef(() => WebsocketGateway))
    private readonly websocketGateway: WebsocketGateway,
    @InjectQueue('deal-verification') private dealVerificationQueue: Queue,
    private readonly redisService: RedisService,
  ) {
    super();
    this.prisma = new PrismaClient();
  }

  async process(job: Job<GlmRequestJob>): Promise<any> {
    this.logger.log(`Processing GLM request for agent ${job.data.agent.name}`);

    // Check rate limit for agent messages
    const rateLimitKey = `agent-message:${job.data.agent.id}`;
    const isAllowed = await this.redisService.checkRateLimit(
      rateLimitKey,
      this.AGENT_MESSAGE_RATE_LIMIT,
      this.AGENT_MESSAGE_RATE_WINDOW,
    );

    if (!isAllowed) {
      this.logger.warn(
        `Agent ${job.data.agent.name} exceeded message rate limit. Skipping this request.`,
      );
      return {
        success: false,
        rateLimited: true,
        message: 'Agent message rate limit exceeded',
      };
    }

    try {
      const response = await this.glmService.generateAgentResponse(
        job.data.agent,
        job.data.roomContext,
        job.data.triggerMessage,
      );

      // Save message summary to database
      await this.prisma.message.create({
        data: {
          roomId: job.data.roomContext.roomId,
          agentId: job.data.agent.id,
          messageType: response.intent,
          priceMentioned: response.priceMentioned,
          sentiment: response.sentiment,
        },
      });

      // Broadcast agent message to room via WebSocket
      this.websocketGateway.broadcastAgentMessage(job.data.roomContext.roomId, {
        agent: {
          id: job.data.agent.id,
          name: job.data.agent.name,
          avatar: '🤖', // Default avatar, should come from agent data
          role: job.data.agent.role,
        },
        message: response.message,
        priceMentioned: response.priceMentioned,
        intent: response.intent,
        sentiment: response.sentiment,
      });

      // Check if this is an acceptance and try to match a deal
      if (response.intent === 'accept' && response.priceMentioned) {
        await this.tryMatchDeal(
          job.data.agent,
          response.priceMentioned,
          job.data.roomContext.roomId,
        );
      }

      this.logger.log(
        `GLM request completed for agent ${job.data.agent.name}: ${response.intent}`,
      );

      return {
        success: true,
        agentId: job.data.agent.id,
        response,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process GLM request for agent ${job.data.agent.name}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Try to match a deal when an agent accepts an offer
   */
  private async tryMatchDeal(
    acceptingAgent: Agent,
    agreedPrice: number,
    roomId: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Agent ${acceptingAgent.name} accepted at price ${agreedPrice}, looking for counterparty...`,
      );

      // Find recent offers/counters in the opposite direction at this price
      const recentMessages = await this.prisma.message.findMany({
        where: {
          roomId,
          priceMentioned: agreedPrice,
          messageType: { in: ['offer', 'counter'] },
          createdAt: {
            gte: new Date(Date.now() - 60000), // Last 60 seconds
          },
        },
        include: {
          agent: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Find a counterparty (buyer if accepting agent is seller, vice versa)
      const counterparty = recentMessages.find(
        (m) =>
          m.agent.role !==
            (acceptingAgent.role as 'buyer' | 'seller') &&
          m.agent.status === 'active',
      );

      if (!counterparty) {
        this.logger.warn(
          `No matching counterparty found for ${acceptingAgent.name}'s acceptance at ${agreedPrice}`,
        );
        return;
      }

      this.logger.log(
        `Found matching counterparty: ${counterparty.agent.name}. Creating deal...`,
      );

      let buyerAgentId: string;
      let sellerAgentId: string;

      if (acceptingAgent.role === 'buyer') {
        buyerAgentId = acceptingAgent.id;
        sellerAgentId = counterparty.agentId;
      } else {
        buyerAgentId = counterparty.agentId;
        sellerAgentId = acceptingAgent.id;
      }

      // Get both agents with their related data
      const [buyerAgent, sellerAgent] = await Promise.all([
        this.prisma.agent.findUnique({
          where: { id: buyerAgentId },
          include: { user: true, room: true },
        }),
        this.prisma.agent.findUnique({
          where: { id: sellerAgentId },
          include: { user: true, nft: true, room: true },
        }),
      ]);

      if (!buyerAgent || !sellerAgent || !sellerAgent.nftId) {
        this.logger.error('Cannot create deal: missing agent data or NFT');
        return;
      }

      // Validate price against mandates
      if (buyerAgent.maxPrice && agreedPrice > buyerAgent.maxPrice.toNumber()) {
        this.logger.warn('Price exceeds buyer max price');
        return;
      }

      if (sellerAgent.minPrice && agreedPrice < sellerAgent.minPrice.toNumber()) {
        this.logger.warn('Price below seller min price');
        return;
      }

      // Create deal and lock both agents in a transaction
      const deal = await this.prisma.$transaction(async (tx) => {
        // Create the deal
        const newDeal = await tx.deal.create({
          data: {
            roomId: buyerAgent.roomId,
            buyerAgentId: buyerAgentId,
            sellerAgentId: sellerAgentId,
            buyerUserId: buyerAgent.userId,
            sellerUserId: sellerAgent.userId,
            nftId: sellerAgent.nftId,
            finalPrice: agreedPrice,
            status: 'locked',
            lockedAt: new Date(),
          },
          include: {
            buyerAgent: { include: { user: true } },
            sellerAgent: { include: { user: true } },
            nft: true,
            room: true,
          },
        });

        // Lock both agents
        await tx.agent.update({
          where: { id: buyerAgentId },
          data: {
            status: 'deal_locked',
            dealId: newDeal.id,
          },
        });

        await tx.agent.update({
          where: { id: sellerAgentId },
          data: {
            status: 'deal_locked',
            dealId: newDeal.id,
          },
        });

        return newDeal;
      });

      this.logger.log(`Deal ${deal.id} created and locked`);

      // Queue background verification job
      await this.dealVerificationQueue.add(
        'verify_deal',
        {
          type: 'verify_deal',
          dealId: deal.id,
          nftId: deal.nftId,
          buyerAddress: deal.buyerAgent.user.walletAddress,
          sellerAddress: deal.sellerAgent.user.walletAddress,
          price: agreedPrice,
        },
        {
          priority: 1, // Critical priority
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.log(`Deal verification job queued for deal ${deal.id}`);

      // Prepare deal data for broadcast
      const dealData = {
        id: deal.id,
        buyerAgent: {
          id: deal.buyerAgent.id,
          name: deal.buyerAgent.name,
          avatar: deal.buyerAgent.avatar,
        },
        sellerAgent: {
          id: deal.sellerAgent.id,
          name: deal.sellerAgent.name,
          avatar: deal.sellerAgent.avatar,
        },
        nft: {
          id: deal.nft.id,
          collection: deal.nft.collection,
          tokenId: deal.nft.tokenId,
          name: deal.nft.name,
          imageUrl: deal.nft.imageUrl,
        },
        price: agreedPrice,
        status: deal.status,
        roomId: deal.roomId,
      };

      // Broadcast deal_locked event
      this.websocketGateway.broadcastDealLocked(roomId, dealData);

      this.logger.log(
        `Deal ${deal.id} created and locked successfully between ${buyerAgentId} and ${sellerAgentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to match deal for agent ${acceptingAgent.name}:`,
        error.stack,
      );
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<GlmRequestJob>, result: any) {
    this.logger.debug(
      `GLM job ${job.id} completed for agent ${job.data.agent.name}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<GlmRequestJob>, error: Error) {
    this.logger.error(
      `GLM job ${job.id} failed for agent ${job.data.agent.name}: ${error.message}`,
    );
  }
}
