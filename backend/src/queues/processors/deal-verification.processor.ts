import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { RustService, ConsensusResponse } from '../../rust/rust.service';
import { PrismaClient } from '@prisma/client';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { RedisService } from '../../redis/redis.service';

export interface DealVerificationJob {
  type: 'verify_deal';
  dealId: string;
  nftId: string;
  buyerAddress: string;
  sellerAddress: string;
  price: number;
}

export interface DealVerificationResult {
  success: boolean;
  dealId: string;
  verified: boolean;
  consensusResult: ConsensusResponse;
  txHash?: string;
  blockNumber?: number;
  error?: string;
}

@Processor('deal-verification', {
  concurrency: 3,
})
export class DealVerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(DealVerificationProcessor.name);
  private readonly prisma = new PrismaClient();

  constructor(
    @Inject(RustService) private readonly rustService: RustService,
    @Inject(forwardRef(() => WebsocketGateway))
    private readonly websocketGateway: WebsocketGateway,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async process(job: Job<DealVerificationJob>): Promise<DealVerificationResult> {
    const { dealId, nftId, buyerAddress, sellerAddress, price } = job.data;

    this.logger.log(`Processing deal verification for deal ${dealId}`);

    try {
      // Fetch deal with all relations to get roomId
      const deal = await this.prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          buyerAgent: true,
          sellerAgent: true,
          nft: true,
          room: true,
        },
      });

      if (!deal) {
        throw new Error(`Deal not found: ${dealId}`);
      }

      const roomId = deal.roomId;

      // Broadcast deal_verifying event with initial status
      this.websocketGateway.broadcastDealVerifying(roomId, {
        dealId,
        progress: 10,
        stage: 'ownership',
        message: 'Verifying NFT ownership...',
      });

      // Step 1: Query NFT ownership on ARK Network via Rust service
      this.logger.log(
        `Verifying NFT ownership: ${deal.nft.collection} #${deal.nft.tokenId} owned by ${sellerAddress}`,
      );
      const ownershipResult = await this.rustService.queryNftOwnership(
        deal.nft.collection,
        deal.nft.tokenId,
        sellerAddress,
      );
      const nftOwnership = ownershipResult.owned;
      this.logger.debug(
        `NFT ownership check: ${nftOwnership} (${deal.nft.collection} #${deal.nft.tokenId})`,
      );

      if (!nftOwnership) {
        this.logger.warn(
          `NFT ownership verification failed: seller ${sellerAddress} does not own ${deal.nft.collection} #${deal.nft.tokenId}`,
        );
        await this.prisma.deal.update({
          where: { id: dealId },
          data: { status: 'failed' },
        });
        return {
          success: false,
          dealId,
          verified: false,
          consensusResult: null as any,
          error: 'NFT ownership verification failed',
        };
      }

      // Broadcast progress: ownership verified
      this.websocketGateway.broadcastDealVerifying(roomId, {
        dealId,
        progress: 40,
        stage: 'balance',
        message: 'Verifying buyer balance...',
      });

      // Step 2: Query USDC balance on ARK Network via Rust service
      this.logger.log(`Verifying buyer balance for address: ${buyerAddress}`);
      const balanceResult = await this.rustService.queryUsdcBalance(buyerAddress);
      const buyerBalance = balanceResult.balance;
      this.logger.debug(
        `Buyer balance check: ${buyerBalance} USDC (needs ${price} USDC)`,
      );

      if (buyerBalance < price) {
        this.logger.warn(
          `Insufficient balance: buyer has ${buyerBalance} USDC but needs ${price} USDC`,
        );
        await this.prisma.deal.update({
          where: { id: dealId },
          data: { status: 'failed' },
        });
        return {
          success: false,
          dealId,
          verified: false,
          consensusResult: null as any,
          error: `Insufficient balance: has ${buyerBalance} USDC, needs ${price} USDC`,
        };
      }

      // Step 3: Generate mock signatures (in production, these would be Ed25519 signatures from both parties)
      // For now, we use placeholder signatures to satisfy the BFT consensus requirement
      const signatures = [
        'mock_buyer_signature_hex',
        'mock_seller_signature_hex',
      ];

      // Broadcast progress: balance verified, running consensus
      this.websocketGateway.broadcastDealVerifying(roomId, {
        dealId,
        progress: 60,
        stage: 'consensus',
        message: 'Running BFT consensus...',
      });

      // Step 4: Run BFT consensus via Rust service
      this.logger.log(`Running BFT consensus for deal ${dealId}`);
      const consensusResult = await this.rustService.runConsensus(
        dealId,
        nftOwnership,
        buyerBalance,
        signatures,
      );

      // Step 5: Update deal status in database
      await this.prisma.deal.update({
        where: { id: dealId },
        data: {
          status: consensusResult.approved ? 'verifying' : 'failed',
          consensusResult: consensusResult as any, // Store full consensus result
          verifiedAt: consensusResult.approved ? new Date() : null,
        },
      });

      if (!consensusResult.approved) {
        this.logger.warn(
          `Consensus rejected for deal ${dealId}: ${consensusResult.approvalCount}/${consensusResult.verifierCount} approved`,
        );
        return {
          success: false,
          dealId,
          verified: false,
          consensusResult,
          error: 'BFT consensus threshold not met',
        };
      }

      // Broadcast progress: consensus approved, executing transaction
      this.websocketGateway.broadcastDealVerifying(roomId, {
        dealId,
        progress: 80,
        stage: 'execution',
        message: 'Executing blockchain transaction...',
      });

      // Step 6: Execute escrow if consensus approved
      this.logger.log(`Consensus approved, executing escrow for deal ${dealId}`);
      const escrowResult = await this.rustService.executeEscrow(
        dealId,
        buyerAddress,
        sellerAddress,
        nftId,
        price,
      );

      // Step 7: Update deal with transaction details and set agents to completed
      await this.prisma.deal.update({
        where: { id: dealId },
        data: {
          status: 'completed',
          txHash: escrowResult.txHash,
          blockNumber: BigInt(escrowResult.blockNumber),
          completedAt: new Date(),
        },
      });

      // Update agents to completed status
      await this.prisma.agent.updateMany({
        where: {
          id: { in: [deal.buyerAgentId, deal.sellerAgentId] },
        },
        data: {
          status: 'completed',
        },
      });

      this.logger.log(
        `Deal verification completed successfully for deal ${dealId}: tx_hash=${escrowResult.txHash}`,
      );

      // Broadcast deal_completed event with full details
      this.websocketGateway.broadcastDealCompleted(roomId, {
        id: dealId,
        buyer: {
          agentId: deal.buyerAgentId,
          agentName: deal.buyerAgent.name,
          wallet: buyerAddress,
        },
        seller: {
          agentId: deal.sellerAgentId,
          agentName: deal.sellerAgent.name,
          wallet: sellerAddress,
        },
        nft: {
          id: deal.nft.id,
          collection: deal.nft.collection,
          tokenId: deal.nft.tokenId,
          name: deal.nft.name,
          imageUrl: deal.nft.imageUrl,
        },
        price,
        txHash: escrowResult.txHash,
        blockNumber: escrowResult.blockNumber,
      });

      // Remove agents from room Redis tracking
      await this.redisService.removeAgentFromFloor(roomId, deal.sellerAgentId);
      await this.redisService.removeAgentFromBids(roomId, deal.buyerAgentId);

      // Broadcast that agents have left the room
      this.websocketGateway.broadcastAgentLeft(roomId, {
        agentId: deal.buyerAgentId,
        name: deal.buyerAgent.name,
        reason: 'bought_nft',
      });

      this.websocketGateway.broadcastAgentLeft(roomId, {
        agentId: deal.sellerAgentId,
        name: deal.sellerAgent.name,
        reason: 'sold_nft',
      });

      return {
        success: true,
        dealId,
        verified: true,
        consensusResult,
        txHash: escrowResult.txHash,
        blockNumber: escrowResult.blockNumber,
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify deal ${dealId}: ${error.message}`,
        error.stack,
      );

      // Update deal status to failed
      await this.prisma.deal.update({
        where: { id: dealId },
        data: {
          status: 'failed',
        },
      }).catch(err => {
        this.logger.error(`Failed to update deal status: ${err.message}`);
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<DealVerificationJob>, result: any) {
    this.logger.debug(
      `Deal verification job ${job.id} completed for deal ${job.data.dealId}`
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DealVerificationJob>, error: Error) {
    this.logger.error(
      `Deal verification job ${job.id} failed for deal ${job.data.dealId}: ${error.message}`
    );
  }
}
