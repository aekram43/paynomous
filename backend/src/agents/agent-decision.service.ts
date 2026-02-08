import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { GlmService, Agent as GlmAgent, RoomContext } from '../glm/glm.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { RedisService } from '../redis/redis.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

export interface AgentDecision {
  shouldRespond: boolean;
  responseMessage?: string;
  priceAdjustment?: number;
  intentAction?: 'offer' | 'counter' | 'accept' | 'reject' | 'wait';
}

export interface MarketContext {
  floorPrice: number;
  topBid: number;
  activeBuyers: number;
  activeSellers: number;
  recentMessages: Array<{
    agentId: string;
    agentName: string;
    message: string;
    priceMentioned?: number;
  }>;
}

@Injectable()
export class AgentDecisionService {
  private readonly logger = new Logger(AgentDecisionService.name);
  private prisma: PrismaClient;

  constructor(
    private glmService: GlmService,
    private websocketGateway: WebsocketGateway,
    private redisService: RedisService,
    @InjectQueue('glm-requests') private glmQueue: Queue,
  ) {
    this.prisma = new PrismaClient();
    this.logger.log('AgentDecisionService initialized');
  }

  /**
   * Main decision engine - called when market conditions change
   */
  async makeDecision(
    agentId: string,
    triggerEvent: 'new_message' | 'price_change' | 'new_agent' | 'periodic_check',
    triggerData?: any,
  ): Promise<AgentDecision> {
    try {
      // Get agent data
      const agent = await this.prisma.agent.findUnique({
        where: { id: agentId },
        include: {
          room: true,
          nft: true,
          user: true,
        },
      });

      if (!agent) {
        this.logger.warn(`Agent ${agentId} not found`);
        return { shouldRespond: false };
      }

      // Skip if agent is not active
      if (agent.status !== 'active' && agent.status !== 'negotiating') {
        return { shouldRespond: false };
      }

      // Get market context
      const marketContext = await this.getMarketContext(agent.roomId);

      // Evaluate if agent should respond based on strategy
      const shouldRespond = this.evaluateShouldRespond(
        agent,
        marketContext,
        triggerEvent,
        triggerData,
      );

      if (!shouldRespond) {
        return { shouldRespond: false };
      }

      // Get suggested price adjustment based on strategy
      const priceAdjustment = this.calculatePriceAdjustment(
        agent,
        marketContext,
      );

      // Update agent's current price if needed
      if (priceAdjustment !== null) {
        await this.updateAgentPrice(agentId, priceAdjustment);
      }

      // Queue GLM request for response generation
      const glmJobId = await this.queueAgentResponse(
        agent,
        marketContext,
        triggerEvent,
        triggerData,
      );

      this.logger.log(
        `Agent ${agent.name} (${agentId}) decision: respond=true, job=${glmJobId}`,
      );

      return {
        shouldRespond: true,
        priceAdjustment: priceAdjustment || undefined,
      };
    } catch (error) {
      this.logger.error(`Decision error for agent ${agentId}:`, error);
      return { shouldRespond: false };
    }
  }

  /**
   * Get market context for decision making
   */
  private async getMarketContext(roomId: string): Promise<MarketContext> {
    // Get floor price from Redis sorted set
    const floorPriceData = await this.redisService.getFloorPrice(roomId);
    const topBidData = await this.redisService.getTopBid(roomId);

    // Get active agent counts
    const activeAgents = await this.prisma.agent.findMany({
      where: {
        roomId,
        status: { in: ['active', 'negotiating'] },
      },
      select: {
        id: true,
        role: true,
      },
    });

    const activeBuyers = activeAgents.filter((a) => a.role === 'buyer').length;
    const activeSellers = activeAgents.filter(
      (a) => a.role === 'seller',
    ).length;

    // Get recent messages (last 10)
    const recentMessages = await this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      floorPrice: floorPriceData || 0,
      topBid: topBidData || 0,
      activeBuyers,
      activeSellers,
      recentMessages: recentMessages.map((m) => ({
        agentId: m.agentId,
        agentName: m.agent.name,
        message: `${m.messageType} ${m.priceMentioned ? `- ${m.priceMentioned} USDC` : ''}`,
        priceMentioned: m.priceMentioned
          ? parseFloat(m.priceMentioned.toString())
          : undefined,
      })),
    };
  }

  /**
   * Evaluate if agent should respond based on strategy and trigger
   */
  private evaluateShouldRespond(
    agent: any,
    marketContext: MarketContext,
    triggerEvent: string,
    triggerData: any,
  ): boolean {
    const { strategy } = agent;

    switch (strategy) {
      case 'aggressive':
        // Aggressive agents respond to almost everything
        return true;

      case 'competitive':
        // Competitive agents respond to price changes and new offers
        if (triggerEvent === 'price_change' || triggerEvent === 'new_message') {
          return true;
        }
        // Also respond periodically
        return Math.random() < 0.7; // 70% chance on periodic check

      case 'patient':
        // Patient agents wait for good opportunities
        if (agent.role === 'seller') {
          // Seller: only respond if offers are close to min price
          const bestOffer = marketContext.topBid;
          return bestOffer >= (agent.minPrice || 0) * 0.9; // Within 90% of min
        } else {
          // Buyer: only respond if floor drops significantly
          const currentFloor = marketContext.floorPrice;
          return currentFloor <= (agent.maxPrice || 0) * 1.1; // Within 110% of max
        }

      case 'sniper':
        // Sniper agents watch quietly, only respond to great opportunities
        if (agent.role === 'seller') {
          const bestOffer = marketContext.topBid;
          return bestOffer >= (agent.maxPrice || agent.startingPrice); // At or above max
        } else {
          const currentFloor = marketContext.floorPrice;
          return currentFloor <= (agent.minPrice || agent.startingPrice) * 0.85; // 15% below target
        }

      case 'conservative':
        // Conservative agents respond slowly and cautiously
        if (triggerEvent === 'new_message') {
          return Math.random() < 0.4; // 40% chance
        }
        return Math.random() < 0.3; // 30% chance on other triggers

      default:
        return Math.random() < 0.5;
    }
  }

  /**
   * Calculate price adjustment based on strategy and market conditions
   */
  private calculatePriceAdjustment(
    agent: any,
    marketContext: MarketContext,
  ): number | null {
    const { role, strategy, startingPrice, minPrice, maxPrice } = agent;

    if (role === 'seller') {
      // Seller price adjustment logic
      const currentFloor = marketContext.floorPrice;
      const currentPrice = startingPrice;

      switch (strategy) {
        case 'aggressive':
          // Undercut floor by 5%
          if (currentFloor && currentFloor < currentPrice) {
            const newPrice = currentFloor * 0.95;
            return Math.max(newPrice, minPrice || 0);
          }
          break;

        case 'competitive':
          // Match floor or slightly undercut
          if (currentFloor && currentFloor < currentPrice) {
            const newPrice = currentFloor * 0.98;
            return Math.max(newPrice, minPrice || 0);
          }
          break;

        case 'patient':
          // Hold price, maybe increase if demand is high
          if (marketContext.activeBuyers > marketContext.activeSellers * 2) {
            const newPrice = currentPrice * 1.05;
            return Math.min(newPrice, maxPrice || currentPrice * 1.2);
          }
          break;

        case 'conservative':
          // Slowly lower price if no activity
          const newPrice = currentPrice * 0.99;
          return Math.max(newPrice, minPrice || 0);

        case 'sniper':
          // Hold price firm
          return null;
      }
    } else {
      // Buyer price adjustment logic
      const currentFloor = marketContext.floorPrice;
      const currentBid = startingPrice;

      switch (strategy) {
        case 'aggressive':
          // Match or beat floor
          if (currentFloor) {
            const newPrice = currentFloor;
            return Math.min(newPrice, maxPrice || Infinity);
          }
          break;

        case 'competitive':
          // Bid close to floor
          if (currentFloor) {
            const newPrice = currentFloor * 0.95;
            return Math.min(newPrice, maxPrice || Infinity);
          }
          break;

        case 'patient':
          // Slowly increase bid if supply is low
          if (marketContext.activeSellers < marketContext.activeBuyers / 2) {
            const newPrice = currentBid * 1.03;
            return Math.min(newPrice, maxPrice || currentBid * 1.2);
          }
          break;

        case 'conservative':
          // Very slow increases
          const newPrice = currentBid * 1.01;
          return Math.min(newPrice, maxPrice || Infinity);

        case 'sniper':
          // Wait for perfect moment
          return null;
      }
    }

    return null;
  }

  /**
   * Update agent's current price in database and Redis
   */
  private async updateAgentPrice(
    agentId: string,
    newPrice: number,
  ): Promise<void> {
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { startingPrice: newPrice },
    });

    // Update Redis sorted sets for floor/bid tracking
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { roomId: true, role: true },
    });

    if (agent) {
      if (agent.role === 'seller') {
        await this.redisService.updateFloorPrice(
          agent.roomId,
          agentId,
          newPrice,
        );
      } else {
        await this.redisService.updateTopBid(agent.roomId, agentId, newPrice);
      }

      this.logger.log(`Updated agent ${agentId} price to ${newPrice}`);
    }
  }

  /**
   * Queue GLM request for agent response generation
   */
  private async queueAgentResponse(
    agent: any,
    marketContext: MarketContext,
    triggerEvent: string,
    triggerData: any,
  ): Promise<string> {
    const glmAgent: GlmAgent = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      communicationStyle: agent.communicationStyle,
      strategy: agent.strategy,
      minPrice: agent.minPrice ? parseFloat(agent.minPrice.toString()) : undefined,
      maxPrice: agent.maxPrice ? parseFloat(agent.maxPrice.toString()) : undefined,
      startingPrice: parseFloat(agent.startingPrice.toString()),
    };

    const roomContext: RoomContext = {
      roomId: agent.roomId,
      floorPrice: marketContext.floorPrice,
      topBid: marketContext.topBid,
      sellerCount: marketContext.activeSellers,
      buyerCount: marketContext.activeBuyers,
      recentMessages: marketContext.recentMessages.map((m) => ({
        agentName: m.agentName,
        message: m.message,
      })),
    };

    let triggerMessage = '';
    switch (triggerEvent) {
      case 'new_message':
        triggerMessage = triggerData?.message || 'Another agent sent a message';
        break;
      case 'price_change':
        triggerMessage = `The floor price changed to ${marketContext.floorPrice} USDC`;
        break;
      case 'new_agent':
        triggerMessage = 'A new agent joined the room';
        break;
      case 'periodic_check':
        triggerMessage = 'Time to check market conditions';
        break;
    }

    const job = await this.glmQueue.add('generate_agent_response', {
      agentId: agent.id,
      agent: glmAgent,
      roomContext,
      triggerMessage,
    });

    return job.id || 'unknown';
  }

  /**
   * Validate if offer should be accepted based on mandate
   */
  async validateOfferAcceptance(
    agentId: string,
    offeredPrice: number,
  ): Promise<{ shouldAccept: boolean; reason: string }> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return { shouldAccept: false, reason: 'Agent not found' };
    }

    if (agent.role === 'seller') {
      // Seller: price must be >= min acceptable
      const minAcceptable = agent.minPrice
        ? parseFloat(agent.minPrice.toString())
        : 0;
      if (offeredPrice >= minAcceptable) {
        return {
          shouldAccept: true,
          reason: `Offer ${offeredPrice} meets minimum ${minAcceptable}`,
        };
      } else {
        return {
          shouldAccept: false,
          reason: `Offer ${offeredPrice} below minimum ${minAcceptable}`,
        };
      }
    } else {
      // Buyer: price must be <= max willing to pay
      const maxWilling = agent.maxPrice
        ? parseFloat(agent.maxPrice.toString())
        : Infinity;
      if (offeredPrice <= maxWilling) {
        return {
          shouldAccept: true,
          reason: `Price ${offeredPrice} within budget ${maxWilling}`,
        };
      } else {
        return {
          shouldAccept: false,
          reason: `Price ${offeredPrice} exceeds budget ${maxWilling}`,
        };
      }
    }
  }

  /**
   * Generate counter-offer based on strategy
   */
  async generateCounterOffer(
    agentId: string,
    currentOffer: number,
  ): Promise<{ counterPrice: number; message: string }> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    const { role, strategy, minPrice, maxPrice, startingPrice } = agent;
    let counterPrice: number;

    if (role === 'seller') {
      // Seller counter-offer logic
      const min = minPrice ? parseFloat(minPrice.toString()) : 0;
      const target = parseFloat(startingPrice.toString());

      switch (strategy) {
        case 'aggressive':
          // Meet halfway quickly
          counterPrice = (currentOffer + target) / 2;
          break;
        case 'competitive':
          // Move 60% toward offer
          counterPrice = target - (target - currentOffer) * 0.6;
          break;
        case 'patient':
          // Move 30% toward offer
          counterPrice = target - (target - currentOffer) * 0.3;
          break;
        case 'conservative':
          // Move 40% toward offer
          counterPrice = target - (target - currentOffer) * 0.4;
          break;
        case 'sniper':
          // Small concession
          counterPrice = target * 0.95;
          break;
        default:
          counterPrice = (currentOffer + target) / 2;
      }

      counterPrice = Math.max(counterPrice, min);
    } else {
      // Buyer counter-offer logic
      const max = maxPrice ? parseFloat(maxPrice.toString()) : Infinity;
      const target = parseFloat(startingPrice.toString());

      switch (strategy) {
        case 'aggressive':
          // Meet halfway quickly
          counterPrice = (currentOffer + target) / 2;
          break;
        case 'competitive':
          // Move 60% toward ask
          counterPrice = target + (currentOffer - target) * 0.6;
          break;
        case 'patient':
          // Move 30% toward ask
          counterPrice = target + (currentOffer - target) * 0.3;
          break;
        case 'conservative':
          // Move 40% toward ask
          counterPrice = target + (currentOffer - target) * 0.4;
          break;
        case 'sniper':
          // Small increase
          counterPrice = target * 1.05;
          break;
        default:
          counterPrice = (currentOffer + target) / 2;
      }

      counterPrice = Math.min(counterPrice, max);
    }

    return {
      counterPrice: Math.round(counterPrice * 100) / 100, // Round to 2 decimals
      message: `Counter-offer calculated based on ${strategy} strategy`,
    };
  }

  /**
   * Process agent message and save to database
   */
  async processAgentMessage(
    agentId: string,
    message: string,
    intent: 'offer' | 'counter' | 'accept' | 'reject' | 'comment',
    priceMentioned?: number,
    sentiment?: 'positive' | 'negative' | 'neutral',
  ): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { roomId: true, messagesSent: true },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Save message summary to database
    await this.prisma.message.create({
      data: {
        roomId: agent.roomId,
        agentId,
        messageType: intent,
        priceMentioned: priceMentioned ? priceMentioned : null,
        sentiment: sentiment || 'neutral',
      },
    });

    // Update agent message count
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { messagesSent: agent.messagesSent + 1 },
    });

    this.logger.log(
      `Processed message from agent ${agentId}: ${intent} ${priceMentioned ? `@ ${priceMentioned}` : ''}`,
    );
  }
}
