import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SpawnAgentDto } from './dto/spawn-agent.dto';

@Injectable()
export class AgentsService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async spawnAgent(userId: string, spawnDto: SpawnAgentDto) {
    // Validate room exists
    const room = await this.prisma.room.findUnique({
      where: { id: spawnDto.roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Validate NFT ownership if seller
    if (spawnDto.role === 'seller') {
      if (!spawnDto.nftId) {
        throw new BadRequestException('NFT ID required for seller agents');
      }

      const nft = await this.prisma.nft.findUnique({
        where: { id: spawnDto.nftId },
      });

      if (!nft) {
        throw new NotFoundException('NFT not found');
      }

      // In production, verify blockchain ownership here
    }

    const agent = await this.prisma.agent.create({
      data: {
        name: spawnDto.name,
        role: spawnDto.role,
        status: 'active',
        strategy: spawnDto.strategy,
        communicationStyle: spawnDto.personality,
        minPrice: spawnDto.minPrice,
        maxPrice: spawnDto.maxPrice,
        startingPrice: spawnDto.startingPrice,
        messagesSent: 0,
        userId: userId,
        roomId: spawnDto.roomId,
        nftId: spawnDto.nftId,
      },
      include: {
        room: true,
        user: {
          select: {
            id: true,
            walletAddress: true,
          },
        },
      },
    });

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      strategy: agent.strategy,
      personality: agent.communicationStyle,
      currentPrice: agent.startingPrice,
      room: {
        id: agent.room.id,
        name: agent.room.name,
      },
      owner: agent.user.walletAddress,
      createdAt: agent.createdAt,
    };
  }

  async findOne(id: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        room: true,
        user: {
          select: {
            id: true,
            walletAddress: true,
          },
        },
        nft: true,
      },
    });

    if (!agent) {
      return null;
    }

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      strategy: agent.strategy,
      personality: agent.communicationStyle,
      currentPrice: agent.startingPrice,
      minPrice: agent.minPrice,
      maxPrice: agent.maxPrice,
      messageCount: agent.messagesSent,
      room: {
        id: agent.room.id,
        name: agent.room.name,
      },
      owner: agent.user.walletAddress,
      nft: agent.nft
        ? {
            id: agent.nft.id,
            tokenId: agent.nft.tokenId,
            imageUrl: agent.nft.imageUrl,
          }
        : null,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  async deleteAgent(id: string, userId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (agent.userId !== userId) {
      throw new BadRequestException('You can only delete your own agents');
    }

    if (agent.status === 'locked' || agent.status === 'completed') {
      throw new BadRequestException('Cannot delete agent in locked or completed state');
    }

    await this.prisma.agent.delete({
      where: { id },
    });

    return { success: true, message: 'Agent deleted successfully' };
  }
}
