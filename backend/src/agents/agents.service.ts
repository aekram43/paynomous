import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SpawnAgentDto } from './dto/spawn-agent.dto';
import { RedisService } from '../redis/redis.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class AgentsService {
  private prisma: PrismaClient;

  constructor(
    private redisService: RedisService,
    @Inject(forwardRef(() => WebsocketGateway))
    private websocketGateway: WebsocketGateway,
  ) {
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
        avatar: spawnDto.avatar || '🤖',
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

    // Initialize Redis floor/bid tracking
    const price = parseFloat(spawnDto.startingPrice.toString());
    if (agent.role === 'seller') {
      await this.redisService.updateFloorPrice(
        spawnDto.roomId,
        agent.id,
        price,
      );
    } else {
      await this.redisService.updateTopBid(spawnDto.roomId, agent.id, price);
    }

    // Broadcast agent_joined event via WebSocket
    this.websocketGateway.broadcastAgentJoined(spawnDto.roomId, {
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar || '🤖',
      role: agent.role,
      strategy: agent.strategy,
      personality: agent.communicationStyle,
      startingPrice: price,
    });

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      strategy: agent.strategy,
      personality: agent.communicationStyle,
      currentPrice: agent.startingPrice?.toString() || '0',
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
      currentPrice: agent.startingPrice?.toString() || '0',
      minPrice: agent.minPrice?.toNumber() || 0,
      maxPrice: agent.maxPrice?.toNumber() || 0,
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

    // Remove from Redis floor/bid tracking
    if (agent.role === 'seller') {
      await this.redisService.removeAgentFromFloor(agent.roomId, agent.id);
    } else {
      await this.redisService.removeAgentFromBids(agent.roomId, agent.id);
    }

    // Broadcast agent_left event
    this.websocketGateway.broadcastAgentLeft(agent.roomId, {
      id: agent.id,
      name: agent.name,
      reason: 'user_removed',
    });

    await this.prisma.agent.delete({
      where: { id },
    });

    return { success: true, message: 'Agent deleted successfully' };
  }

  async findMyAgents(userId: string) {
    const agents = await this.prisma.agent.findMany({
      where: {
        userId: userId,
      },
      include: {
        room: true,
        nft: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      role: agent.role,
      status: agent.status,
      strategy: agent.strategy,
      personality: agent.communicationStyle,
      minPrice: agent.minPrice,
      maxPrice: agent.maxPrice,
      startingPrice: agent.startingPrice,
      messagesSent: agent.messagesSent,
      roomId: agent.roomId,
      room: {
        id: agent.room.id,
        name: agent.room.name,
        collection: agent.room.collection,
      },
      nftId: agent.nftId,
      nft: agent.nft
        ? {
            id: agent.nft.id,
            name: agent.nft.name,
            collection: agent.nft.collection,
            imageUrl: agent.nft.imageUrl,
          }
        : null,
      dealId: agent.dealId,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    }));
  }
}
