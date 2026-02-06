import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { AppLoggerService, LogContext } from '../logger/logger.service';

// Request/Response types matching Rust service
export interface VerifySignatureRequest {
  message: string;
  signature: string;
  publicKey: string;
}

export interface VerifySignatureResponse {
  valid: boolean;
  error?: string;
}

export interface ConsensusRequest {
  dealId: string;
  nftOwnership: boolean;
  buyerBalance: number;
  signatures: string[];
}

export interface VerifierChecks {
  nftOwnership: boolean;
  buyerBalance: boolean;
  signatureValidity: boolean;
}

export interface VerifierResult {
  verifierId: string;
  approved: boolean;
  checks: VerifierChecks;
}

export interface ConsensusResponse {
  approved: boolean;
  verifierCount: number;
  approvalCount: number;
  threshold: number;
  verifiers: VerifierResult[];
  executionTimeMs: number;
}

export interface EscrowRequest {
  dealId: string;
  buyerAddress: string;
  sellerAddress: string;
  nftId: string;
  price: number;
}

export interface EscrowResponse {
  success: boolean;
  txHash: string;
  blockNumber: number;
}

export interface NftOwnershipRequest {
  collection: string;
  tokenId: string;
  ownerAddress: string;
}

export interface NftOwnershipResponse {
  owned: boolean;
  collection: string;
  tokenId: string;
  owner: string;
}

export interface BalanceRequest {
  address: string;
}

export interface BalanceResponse {
  address: string;
  balance: number;
}

@Injectable()
export class RustService {
  private readonly logger = new Logger(RustService.name);
  private readonly appLogger: AppLoggerService;
  private readonly client: AxiosInstance;
  private readonly serviceUrl: string;

  constructor() {
    this.appLogger = new AppLoggerService(RustService.name);
    this.serviceUrl = process.env.RUST_SERVICE_URL || 'http://localhost:8080';
    this.client = axios.create({
      baseURL: this.serviceUrl,
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`Rust service client initialized: ${this.serviceUrl}`);
  }

  /**
   * Verify Ed25519 signature
   */
  async verifySignature(
    message: string,
    signature: string,
    publicKey: string,
  ): Promise<VerifySignatureResponse> {
    const endpoint = `${this.serviceUrl}/verify-signature`;
    try {
      this.logger.debug(`Verifying signature for message: ${message}`);

      const response = await this.client.post<VerifySignatureResponse>(
        '/verify-signature',
        {
          message,
          signature,
          public_key: publicKey,
        },
      );

      this.logger.debug(
        `Signature verification result: ${response.data.valid}`,
      );
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        const logContext: LogContext = { operation: 'signature_verification' };
        this.appLogger.logBlockchainFailure(
          'verify_signature',
          'Ed25519',
          error,
          logContext,
        );
      }
      throw new Error(`Rust service signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run BFT consensus for deal verification
   */
  async runConsensus(
    dealId: string,
    nftOwnership: boolean,
    buyerBalance: number,
    signatures: string[],
  ): Promise<ConsensusResponse> {
    const endpoint = `${this.serviceUrl}/run-consensus`;
    try {
      this.logger.log(
        `Running BFT consensus for deal ${dealId} (NFT: ${nftOwnership}, Balance: ${buyerBalance}, Sigs: ${signatures.length})`,
      );

      const response = await this.client.post<ConsensusResponse>(
        '/run-consensus',
        {
          deal_id: dealId,
          nft_ownership: nftOwnership,
          buyer_balance: buyerBalance,
          signatures,
        },
      );

      const result = response.data;
      this.logger.log(
        `Consensus result: ${result.approved} (${result.approvalCount}/${result.verifierCount} approved, ${result.executionTimeMs}ms)`,
      );

      return {
        approved: result.approved,
        verifierCount: result.verifierCount,
        approvalCount: result.approvalCount,
        threshold: result.threshold,
        verifiers: result.verifiers.map((v) => ({
          verifierId: v.verifierId,
          approved: v.approved,
          checks: {
            nftOwnership: v.checks.nftOwnership,
            buyerBalance: v.checks.buyerBalance,
            signatureValidity: v.checks.signatureValidity,
          },
        })),
        executionTimeMs: result.executionTimeMs,
      };
    } catch (error) {
      if (error instanceof Error) {
        const logContext: LogContext = {
          dealId,
          operation: 'bft_consensus',
          verifierCount: 7,
        };
        this.appLogger.logBlockchainFailure(
          'run_consensus',
          'BFT',
          error,
          logContext,
        );
      }
      throw new Error(`Rust service consensus failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute escrow transaction on blockchain
   */
  async executeEscrow(
    dealId: string,
    buyerAddress: string,
    sellerAddress: string,
    nftId: string,
    price: number,
  ): Promise<EscrowResponse> {
    const endpoint = `${this.serviceUrl}/execute-escrow`;
    try {
      this.logger.log(
        `Executing escrow for deal ${dealId}: ${nftId} from ${sellerAddress} to ${buyerAddress} for ${price} USDC`,
      );

      const response = await this.client.post<EscrowResponse>(
        '/execute-escrow',
        {
          deal_id: dealId,
          buyer_address: buyerAddress,
          seller_address: sellerAddress,
          nft_id: nftId,
          price,
        },
      );

      this.logger.log(
        `Escrow executed: tx_hash=${response.data.txHash}, block=${response.data.blockNumber}`,
      );

      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        const logContext: LogContext = {
          dealId,
          operation: 'escrow_execution',
          buyerAddress,
          sellerAddress,
          nftId,
          price,
        };
        this.appLogger.logBlockchainFailure(
          'execute_escrow',
          'NFT+USDC transfer',
          error,
          logContext,
        );
      }
      throw new Error(`Rust service escrow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Query NFT ownership on ARK Network
   */
  async queryNftOwnership(
    collection: string,
    tokenId: string,
    ownerAddress: string,
  ): Promise<NftOwnershipResponse> {
    const endpoint = `${this.serviceUrl}/query-nft-ownership`;
    try {
      this.logger.debug(
        `Querying NFT ownership: collection=${collection}, tokenId=${tokenId}, owner=${ownerAddress}`,
      );

      const response = await this.client.post<NftOwnershipResponse>(
        '/query-nft-ownership',
        {
          collection,
          token_id: tokenId,
          owner_address: ownerAddress,
        },
      );

      this.logger.debug(
        `NFT ownership result: ${response.data.owned} (${collection} #${tokenId})`,
      );

      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        const logContext: LogContext = {
          operation: 'nft_ownership_query',
          collection,
          tokenId,
          ownerAddress,
        };
        this.appLogger.logBlockchainFailure(
          'query_nft_ownership',
          'ARK Network',
          error,
          logContext,
        );
      }
      throw new Error(`Rust service NFT ownership query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Query USDC balance on ARK Network
   */
  async queryUsdcBalance(address: string): Promise<BalanceResponse> {
    const endpoint = `${this.serviceUrl}/query-usdc-balance`;
    try {
      this.logger.debug(`Querying USDC balance for address: ${address}`);

      const response = await this.client.post<BalanceResponse>(
        '/query-usdc-balance',
        {
          address,
        },
      );

      this.logger.debug(
        `USDC balance result: ${response.data.balance} USDC for ${address}`,
      );

      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        const logContext: LogContext = {
          operation: 'balance_query',
          walletAddress: address,
        };
        this.appLogger.logBlockchainFailure(
          'query_usdc_balance',
          'USDC',
          error,
          logContext,
        );
      }
      throw new Error(`Rust service balance query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check Rust service health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      this.logger.error(`Rust service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
}
