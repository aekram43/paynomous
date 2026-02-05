import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SpawnSwarmDto } from './dto/spawn-swarm.dto';

@Injectable()
export class SwarmsService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async spawnSwarm(userId: string, spawnDto: SpawnSwarmDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: spawnDto.roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const presetConfig = this.getPresetConfig(spawnDto.preset);

    const swarm = await this.prisma.swarm.create({
      data: {
        preset: spawnDto.preset,
        totalAgents: presetConfig.totalAgents,
        buyersCount: presetConfig.buyers,
        sellersCount: presetConfig.sellers,
        status: 'running',
        dealsCompleted: 0,
        userId: userId,
        roomId: spawnDto.roomId,
      },
    });

    return {
      id: swarm.id,
      name: spawnDto.name,
      preset: swarm.preset,
      agentCount: swarm.totalAgents,
      status: swarm.status,
      config: presetConfig,
      createdAt: swarm.createdAt,
    };
  }

  async findOne(id: string) {
    const swarm = await this.prisma.swarm.findUnique({
      where: { id },
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

    if (!swarm) {
      return null;
    }

    return {
      id: swarm.id,
      name: `Swarm ${swarm.id.substring(0, 8)}`,
      preset: swarm.preset,
      agentCount: swarm.totalAgents,
      status: swarm.status,
      dealsCompleted: swarm.dealsCompleted,
      room: {
        id: swarm.room.id,
        name: swarm.room.name,
      },
      owner: swarm.user.walletAddress,
      createdAt: swarm.createdAt,
      updatedAt: swarm.updatedAt,
    };
  }

  async updateSwarm(id: string, userId: string, status: string) {
    const swarm = await this.prisma.swarm.findUnique({
      where: { id },
    });

    if (!swarm) {
      throw new NotFoundException('Swarm not found');
    }

    if (swarm.userId !== userId) {
      throw new NotFoundException('Swarm not found');
    }

    const updated = await this.prisma.swarm.update({
      where: { id },
      data: { status },
    });

    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }

  private getPresetConfig(preset: string) {
    const configs = {
      small_test: { totalAgents: 5, buyers: 3, sellers: 2 },
      balanced_market: { totalAgents: 10, buyers: 5, sellers: 5 },
      high_competition: { totalAgents: 20, buyers: 12, sellers: 8 },
      buyers_market: { totalAgents: 20, buyers: 15, sellers: 5 },
    };

    return configs[preset] || configs.small_test;
  }
}
