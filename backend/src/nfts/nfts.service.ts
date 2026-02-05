import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { VerifyOwnershipDto } from './dto/verify-ownership.dto';

@Injectable()
export class NftsService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async findAll(collectionName?: string) {
    const where = collectionName ? { collection: collectionName } : {};

    const nfts = await this.prisma.nft.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return nfts.map((nft) => ({
      id: nft.id,
      name: nft.name,
      collection: nft.collection,
      tokenId: nft.tokenId,
      imageUrl: nft.imageUrl,
      metadata: nft.metadata,
      createdAt: nft.createdAt,
    }));
  }

  async verifyOwnership(verifyDto: VerifyOwnershipDto) {
    // In production, this would call the blockchain to verify ownership
    // For now, return mock verification
    const nft = await this.prisma.nft.findFirst({
      where: {
        collection: verifyDto.collectionAddress.toLowerCase(),
        tokenId: verifyDto.tokenId,
      },
    });

    if (!nft) {
      return {
        verified: false,
        message: 'NFT not found',
      };
    }

    // Mock verification - in production would check blockchain
    return {
      verified: true,
      nft: {
        id: nft.id,
        collection: nft.collection,
        tokenId: nft.tokenId,
        imageUrl: nft.imageUrl,
      },
      owner: verifyDto.walletAddress,
      message: 'Ownership verified (mock)',
    };
  }
}
