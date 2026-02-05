import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { VerifyOwnershipDto } from './dto/verify-ownership.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class NftsService {
  private prisma: PrismaClient;

  constructor(private readonly redisService: RedisService) {
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

    // Cache each NFT's metadata
    const result = nfts.map((nft) => ({
      id: nft.id,
      name: nft.name,
      collection: nft.collection,
      tokenId: nft.tokenId,
      imageUrl: nft.imageUrl,
      metadata: nft.metadata,
      createdAt: nft.createdAt,
    }));

    // Cache metadata for each NFT (fire and forget)
    for (const nft of result) {
      this.redisService.cacheNftMetadata(nft.id, {
        name: nft.name,
        collection: nft.collection,
        tokenId: nft.tokenId,
        imageUrl: nft.imageUrl,
        metadata: nft.metadata,
      });
    }

    return result;
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
