import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DealsService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
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
