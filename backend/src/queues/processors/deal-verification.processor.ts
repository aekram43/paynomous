import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { RustService, ConsensusResponse } from '../../rust/rust.service';
import { PrismaClient } from '@prisma/client';

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

  constructor(@Inject(RustService) private readonly rustService: RustService) {
    super();
  }

  async process(job: Job<DealVerificationJob>): Promise<DealVerificationResult> {
    const { dealId, nftId, buyerAddress, sellerAddress, price } = job.data;

    this.logger.log(`Processing deal verification for deal ${dealId}`);

    try {
      // Step 1: Mock NFT ownership verification (ARK Network integration in US-013)
      // In production, this would query the blockchain
      const nftOwnership = true; // Mock: assume seller owns the NFT
      this.logger.debug(`NFT ownership check: ${nftOwnership}`);

      // Step 2: Mock buyer balance verification (ARK Network integration in US-013)
      // In production, this would query the blockchain for USDC balance
      const buyerBalance = price + 100; // Mock: assume buyer has sufficient balance
      this.logger.debug(`Buyer balance check: ${buyerBalance} USDC`);

      // Step 3: Mock signatures (in production, these would be Ed25519 signatures)
      const signatures = [
        'mock_buyer_signature_hex',
        'mock_seller_signature_hex',
      ];

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

      // Step 6: Execute escrow if consensus approved (mock for now, real implementation in US-013)
      this.logger.log(`Consensus approved, executing escrow for deal ${dealId}`);
      const escrowResult = await this.rustService.executeEscrow(
        dealId,
        buyerAddress,
        sellerAddress,
        nftId,
        price,
      );

      // Step 7: Update deal with transaction details
      await this.prisma.deal.update({
        where: { id: dealId },
        data: {
          status: 'completed',
          txHash: escrowResult.txHash,
          blockNumber: BigInt(escrowResult.blockNumber),
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Deal verification completed successfully for deal ${dealId}: tx_hash=${escrowResult.txHash}`,
      );

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
