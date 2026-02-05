import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RoomsService {
  private prisma: PrismaClient;

  constructor(private readonly redisService: RedisService) {
    this.prisma = new PrismaClient();
  }

  async findAll() {
    const rooms = await this.prisma.room.findMany({
      include: {
        _count: {
          select: { agents: true },
        },
      },
    });

    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      collection: room.collection,
      status: room.status,
      activeAgentsCount: room._count.agents,
      createdAt: room.createdAt,
    }));
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        agents: {
          include: {
            user: {
              select: {
                id: true,
                walletAddress: true,
              },
            },
          },
        },
        _count: {
          select: { agents: true, deals: true },
        },
      },
    });

    if (!room) {
      return null;
    }

    return {
      id: room.id,
      name: room.name,
      collection: room.collection,
      status: room.status,
      activeAgentsCount: room._count.agents,
      totalDeals: room._count.deals,
      agents: room.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        owner: agent.user.walletAddress,
      })),
      createdAt: room.createdAt,
    };
  }

  async getStats(id: string) {
    // Check cache first (5 second TTL)
    const cachedStats = await this.redisService.getRoomStats(id);
    if (cachedStats) {
      return cachedStats;
    }

    // Fetch from database if not in cache
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        agents: {
          where: { status: 'active' },
        },
        deals: {
          where: { status: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!room) {
      return null;
    }

    const buyers = room.agents.filter((a) => a.role === 'buyer');
    const sellers = room.agents.filter((a) => a.role === 'seller');

    const stats = {
      activeAgents: room.agents.length,
      activeBuyers: buyers.length,
      activeSellers: sellers.length,
      totalDeals: room.deals.length,
      recentDeals: room.deals.map((deal) => ({
        id: deal.id,
        price: deal.finalPrice,
        status: deal.status,
        createdAt: deal.createdAt,
      })),
    };

    // Cache the stats (5 second TTL)
    await this.redisService.cacheRoomStats(id, stats);

    return stats;
  }
}
