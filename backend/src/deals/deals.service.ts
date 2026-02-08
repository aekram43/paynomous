import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);
  private prisma: PrismaClient;

  constructor(
    @InjectQueue('deal-verification') private dealVerificationQueue: Queue,
  ) {
    this.prisma = new PrismaClient();
  }

  /**
   * Create and lock a deal between buyer and seller agents
   */
  async createAndLockDeal(
    buyerAgentId: string,
    sellerAgentId: string,
    agreedPrice: number,
  ) {
    this.logger.log(
      `Creating deal between buyer ${buyerAgentId} and seller ${sellerAgentId} at price ${agreedPrice}`,
    );

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

    if (!buyerAgent || !sellerAgent) {
      throw new BadRequestException('One or both agents not found');
    }

    if (buyerAgent.roomId !== sellerAgent.roomId) {
      throw new BadRequestException('Agents must be in the same room');
    }

    if (!sellerAgent.nftId) {
      throw new BadRequestException('Seller agent has no NFT');
    }

    // Validate price against mandates
    if (buyerAgent.maxPrice && agreedPrice > buyerAgent.maxPrice.toNumber()) {
      throw new BadRequestException('Price exceeds buyer max price');
    }

    if (sellerAgent.minPrice && agreedPrice < sellerAgent.minPrice.toNumber()) {
      throw new BadRequestException('Price below seller min price');
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

    return {
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
  }

  async findOne(id: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: {
        buyerAgent: {
          include: {
            user: {
              select: {
                walletAddress: true,
              },
            },
          },
        },
        sellerAgent: {
          include: {
            user: {
              select: {
                walletAddress: true,
              },
            },
          },
        },
        nft: true,
        room: true,
      },
    });

    if (!deal) {
      return null;
    }

    return {
      id: deal.id,
      price: deal.finalPrice,
      status: deal.status,
      buyer: {
        agent: deal.buyerAgent.name,
        wallet: deal.buyerAgent.user.walletAddress,
      },
      seller: {
        agent: deal.sellerAgent.name,
        wallet: deal.sellerAgent.user.walletAddress,
      },
      nft: {
        id: deal.nft.id,
        tokenId: deal.nft.tokenId,
        collection: deal.nft.collection,
        imageUrl: deal.nft.imageUrl,
      },
      room: {
        id: deal.room.id,
        name: deal.room.name,
      },
      txHash: deal.txHash,
      blockNumber: deal.blockNumber ? deal.blockNumber.toString() : null,
      consensusResult: deal.consensusResult,
      createdAt: deal.createdAt,
      completedAt: deal.completedAt,
    };
  }

  async findMyDeals(userId: string) {
    const deals = await this.prisma.deal.findMany({
      where: {
        OR: [
          {
            buyerAgent: {
              userId: userId,
            },
          },
          {
            sellerAgent: {
              userId: userId,
            },
          },
        ],
      },
      include: {
        buyerAgent: {
          include: {
            user: {
              select: {
                walletAddress: true,
              },
            },
          },
        },
        sellerAgent: {
          include: {
            user: {
              select: {
                walletAddress: true,
              },
            },
          },
        },
        nft: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return deals.map((deal) => ({
      id: deal.id,
      price: deal.finalPrice,
      status: deal.status,
      buyer: {
        agent: deal.buyerAgent.name,
        wallet: deal.buyerAgent.user.walletAddress,
      },
      seller: {
        agent: deal.sellerAgent.name,
        wallet: deal.sellerAgent.user.walletAddress,
      },
      nft: {
        id: deal.nft.id,
        tokenId: deal.nft.tokenId,
        collection: deal.nft.collection,
      },
      txHash: deal.txHash,
      createdAt: deal.createdAt,
      completedAt: deal.completedAt,
    }));
  }
}
