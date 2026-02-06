import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SpawnSwarmDto } from './dto/spawn-swarm.dto';
import { AgentsService } from '../agents/agents.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { RedisService } from '../redis/redis.service';

const AVATARS = ['🤖', '🦊', '🐼', '🦄', '🐲', '👻', '👽', '🤡', '💀', '🎭'];
const NAMES = ['Trader', 'Dealer', 'Broker', 'Merchant', 'Negotiator', 'Broker', 'Agent', 'Bot'];
const ADJECTIVES = ['Swift', 'Calm', 'Bold', 'Wise', 'Smart', 'Quick', 'Steady', 'Sharp'];
const STRATEGIES: Array<'competitive' | 'patient' | 'aggressive' | 'conservative' | 'sniper'> = [
  'competitive',
  'patient',
  'aggressive',
  'conservative',
  'sniper',
];
const PERSONALITIES: Array<'formal' | 'casual' | 'professional' | 'aggressive'> = [
  'formal',
  'casual',
  'professional',
  'aggressive',
];

@Injectable()
export class SwarmsService {
  private prisma: PrismaClient;
  private swarmIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @Inject(forwardRef(() => AgentsService))
    private agentsService: AgentsService,
    @Inject(forwardRef(() => WebsocketGateway))
    private websocketGateway: WebsocketGateway,
    private redisService: RedisService,
  ) {
    this.prisma = new PrismaClient();
  }

  async spawnSwarm(userId: string, spawnDto: SpawnSwarmDto) {
    // Validate room exists
    const room = await this.prisma.room.findUnique({
      where: { id: spawnDto.roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const presetConfig = this.getPresetConfig(spawnDto.preset);

    // Create swarm record
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

    // Create mock wallets for swarm agents
    const mockWallets = this.generateMockWallets(presetConfig.totalAgents);

    // Get mock NFTs for sellers
    const mockNfts = await this.getMockNfts(spawnDto.roomId, presetConfig.sellers);

    // Spawn all agents
    const agents = await this.spawnSwarmAgents(
      spawnDto.roomId,
      swarm.id,
      presetConfig,
      mockWallets,
      mockNfts,
      userId,
    );

    // Start swarm monitoring
    this.startSwarmMonitoring(swarm.id, spawnDto.roomId);

    return {
      id: swarm.id,
      name: spawnDto.name || `Swarm ${swarm.id.substring(0, 8)}`,
      preset: swarm.preset,
      totalAgents: swarm.totalAgents,
      buyersCount: swarm.buyersCount,
      sellersCount: swarm.sellersCount,
      status: swarm.status,
      agents: agents,
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
        agents: {
          include: {
            nft: true,
          },
        },
      },
    });

    if (!swarm) {
      return null;
    }

    // Calculate analytics
    const analytics = await this.calculateSwarmAnalytics(id);

    return {
      id: swarm.id,
      name: `Swarm ${swarm.id.substring(0, 8)}`,
      preset: swarm.preset,
      status: swarm.status,
      totalAgents: swarm.totalAgents,
      buyersCount: swarm.buyersCount,
      sellersCount: swarm.sellersCount,
      dealsCompleted: swarm.dealsCompleted,
      room: {
        id: swarm.room.id,
        name: swarm.room.name,
        collection: swarm.room.collection,
      },
      owner: swarm.user.walletAddress,
      agents: swarm.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
        role: agent.role,
        status: agent.status,
        strategy: agent.strategy,
        personality: agent.communicationStyle,
        startingPrice: agent.startingPrice?.toNumber() || 0,
        messagesSent: agent.messagesSent,
        nft: agent.nft,
      })),
      analytics,
      createdAt: swarm.createdAt,
      updatedAt: swarm.updatedAt,
    };
  }

  async updateSwarm(id: string, userId: string, action: string) {
    const swarm = await this.prisma.swarm.findUnique({
      where: { id },
    });

    if (!swarm) {
      throw new NotFoundException('Swarm not found');
    }

    if (swarm.userId !== userId) {
      throw new BadRequestException('You can only control your own swarms');
    }

    let newStatus: string;
    switch (action) {
      case 'pause':
        newStatus = 'paused';
        this.stopSwarmMonitoring(id);
        break;
      case 'resume':
        if (swarm.status !== 'paused') {
          throw new BadRequestException('Can only resume paused swarms');
        }
        newStatus = 'running';
        this.startSwarmMonitoring(id, swarm.roomId);
        break;
      case 'stop':
        newStatus = 'completed';
        this.stopSwarmMonitoring(id);
        await this.cleanupSwarmAgents(id);
        break;
      default:
        throw new BadRequestException('Invalid action. Use: pause, resume, or stop');
    }

    const updated = await this.prisma.swarm.update({
      where: { id },
      data: { status: newStatus },
    });

    // Broadcast swarm status update via WebSocket
    this.websocketGateway.broadcastMessage(swarm.roomId, {
      type: 'swarm_status_update',
      swarmId: id,
      status: newStatus,
      timestamp: new Date().toISOString(),
    });

    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }

  async exportAnalytics(id: string, userId: string) {
    const swarm = await this.prisma.swarm.findUnique({
      where: { id },
      include: {
        agents: {
          include: {
            room: true,
            nft: true,
          },
        },
        room: true,
      },
    });

    if (!swarm) {
      throw new NotFoundException('Swarm not found');
    }

    if (swarm.userId !== userId) {
      throw new BadRequestException('You can only export your own swarms');
    }

    // Get deals completed by this swarm's agents
    const deals = await this.prisma.deal.findMany({
      where: {
        OR: [
          { buyerAgentId: { in: swarm.agents.map((a) => a.id) } },
          { sellerAgentId: { in: swarm.agents.map((a) => a.id) } },
        ],
      },
      include: {
        buyerAgent: true,
        sellerAgent: true,
        nft: true,
      },
    });

    const analytics = {
      swarm: {
        id: swarm.id,
        preset: swarm.preset,
        status: swarm.status,
        totalAgents: swarm.totalAgents,
        buyersCount: swarm.buyersCount,
        sellersCount: swarm.sellersCount,
        dealsCompleted: swarm.dealsCompleted,
      },
      room: {
        id: swarm.room.id,
        name: swarm.room.name,
        collection: swarm.room.collection,
      },
      agents: swarm.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        strategy: agent.strategy,
        personality: agent.communicationStyle,
        startingPrice: agent.startingPrice?.toNumber() || 0,
        minPrice: agent.minPrice?.toNumber() || 0,
        maxPrice: agent.maxPrice?.toNumber() || 0,
        messagesSent: agent.messagesSent,
        nft: agent.nft
          ? {
              id: agent.nft.id,
              collection: agent.nft.collection,
              tokenId: agent.nft.tokenId,
              name: agent.nft.name,
            }
          : null,
      })),
      deals: deals.map((deal) => ({
        id: deal.id,
        buyerAgentId: deal.buyerAgentId,
        sellerAgentId: deal.sellerAgentId,
        nft: {
          id: deal.nft.id,
          collection: deal.nft.collection,
          tokenId: deal.nft.tokenId,
          name: deal.nft.name,
        },
        finalPrice: deal.finalPrice.toNumber(),
        status: deal.status,
        txHash: deal.txHash,
        blockNumber: deal.blockNumber?.toString(),
        lockedAt: deal.lockedAt,
        completedAt: deal.completedAt,
      })),
      analytics: await this.calculateSwarmAnalytics(id),
      exportedAt: new Date().toISOString(),
    };

    return analytics;
  }

  private async spawnSwarmAgents(
    roomId: string,
    swarmId: string,
    config: { totalAgents: number; buyers: number; sellers: number },
    mockWallets: string[],
    mockNfts: any[],
    userId: string,
  ) {
    const agents = [];
    let buyerIndex = 0;
    let sellerIndex = 0;

    for (let i = 0; i < config.totalAgents; i++) {
      const isBuyer = i < config.buyers;
      const role = isBuyer ? 'buyer' : 'seller';

      // Generate random agent config
      const name = this.generateAgentName(role, i);
      const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
      const strategy = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
      const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];

      // Generate price ranges based on role
      const basePrice = this.generateRandomPrice();
      let minPrice: number, maxPrice: number, startingPrice: number;

      if (role === 'seller') {
        minPrice = basePrice * 0.8;
        maxPrice = basePrice * 1.5;
        startingPrice = basePrice * 1.2;
      } else {
        minPrice = basePrice * 0.5;
        maxPrice = basePrice * 1.3;
        startingPrice = basePrice * 0.9;
      }

      // Create agent directly in database (skip auth wallet ownership for swarm)
      const mockWallet = mockWallets[i];
      const mockUser = await this.getOrCreateMockUser(mockWallet);

      const agentData: any = {
        name,
        avatar,
        role,
        status: 'active',
        strategy,
        communicationStyle: personality,
        minPrice,
        maxPrice,
        startingPrice,
        messagesSent: 0,
        userId: mockUser.id,
        roomId,
        swarmId,
      };

      if (role === 'seller' && sellerIndex < mockNfts.length) {
        agentData.nftId = mockNfts[sellerIndex].id;
        sellerIndex++;
      }

      const agent = await this.prisma.agent.create({
        data: agentData,
      });

      // Initialize Redis floor/bid tracking
      if (role === 'seller') {
        await this.redisService.updateFloorPrice(roomId, agent.id, startingPrice);
      } else {
        await this.redisService.updateTopBid(roomId, agent.id, startingPrice);
      }

      // Broadcast agent_joined event
      this.websocketGateway.broadcastAgentJoined(roomId, {
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar || '🤖',
        role: agent.role,
        strategy: agent.strategy,
        personality: agent.communicationStyle,
        startingPrice,
      });

      agents.push({
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
        role: agent.role,
        status: agent.status,
        strategy: agent.strategy,
        personality: agent.communicationStyle,
        startingPrice,
      });
    }

    return agents;
  }

  private generateMockWallets(count: number): string[] {
    const wallets = [];
    for (let i = 0; i < count; i++) {
      wallets.push(`0x${Math.random().toString(16).substring(2, 42).padStart(40, '0')}`);
    }
    return wallets;
  }

  private async getMockNfts(roomId: string, count: number) {
    // Get available NFTs from the room's collection
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return [];
    }

    const nfts = await this.prisma.nft.findMany({
      where: {
        collection: room.collection,
      },
      take: count,
    });

    return nfts;
  }

  private async getOrCreateMockUser(walletAddress: string) {
    let user = await this.prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          walletAddress,
          nonce: Math.random().toString(36),
        },
      });
    }

    return user;
  }

  private generateAgentName(role: string, index: number) {
    const adj = ADJECTIVES[index % ADJECTIVES.length];
    const noun = NAMES[index % NAMES.length];
    return `${adj}${noun}${index + 1}`;
  }

  private generateRandomPrice(): number {
    // Generate random price between 20 and 100 USDC
    return Math.floor(Math.random() * 80) + 20;
  }

  private startSwarmMonitoring(swarmId: string, roomId: string) {
    // Clear existing interval if any
    if (this.swarmIntervals.has(swarmId)) {
      clearInterval(this.swarmIntervals.get(swarmId));
    }

    // Update swarm stats every 30 seconds
    const interval = setInterval(async () => {
      await this.updateSwarmStats(swarmId, roomId);
    }, 30000);

    this.swarmIntervals.set(swarmId, interval);
  }

  private stopSwarmMonitoring(swarmId: string) {
    const interval = this.swarmIntervals.get(swarmId);
    if (interval) {
      clearInterval(interval);
      this.swarmIntervals.delete(swarmId);
    }
  }

  private async updateSwarmStats(swarmId: string, roomId: string) {
    const swarm = await this.prisma.swarm.findUnique({
      where: { id: swarmId },
      include: {
        agents: true,
      },
    });

    if (!swarm || swarm.status !== 'running') {
      return;
    }

    // Count completed deals
    const dealsCompleted = await this.prisma.deal.count({
      where: {
        OR: [
          { buyerAgentId: { in: swarm.agents.map((a) => a.id) } },
          { sellerAgentId: { in: swarm.agents.map((a) => a.id) } },
        ],
        status: 'completed',
      },
    });

    await this.prisma.swarm.update({
      where: { id: swarmId },
      data: { dealsCompleted },
    });

    // Broadcast update via WebSocket
    this.websocketGateway.broadcastMessage(roomId, {
      type: 'swarm_stats_update',
      swarmId,
      dealsCompleted,
      timestamp: new Date().toISOString(),
    });
  }

  private async cleanupSwarmAgents(swarmId: string) {
    const swarm = await this.prisma.swarm.findUnique({
      where: { id: swarmId },
      include: {
        agents: true,
      },
    });

    if (!swarm) {
      return;
    }

    // Remove all agents from Redis and update status
    for (const agent of swarm.agents) {
      if (agent.role === 'seller') {
        await this.redisService.removeAgentFromFloor(agent.roomId, agent.id);
      } else {
        await this.redisService.removeAgentFromBids(agent.roomId, agent.id);
      }

      // Broadcast agent_left event
      this.websocketGateway.broadcastAgentLeft(agent.roomId, {
        id: agent.id,
        name: agent.name,
        reason: 'swarm_completed',
      });
    }

    // Delete all agents
    await this.prisma.agent.deleteMany({
      where: { swarmId },
    });
  }

  private async calculateSwarmAnalytics(swarmId: string) {
    const swarm = await this.prisma.swarm.findUnique({
      where: { id: swarmId },
      include: {
        agents: true,
      },
    });

    if (!swarm) {
      return null;
    }

    const agentIds = swarm.agents.map((a) => a.id);

    // Get deals
    const deals = await this.prisma.deal.findMany({
      where: {
        OR: [
          { buyerAgentId: { in: agentIds } },
          { sellerAgentId: { in: agentIds } },
        ],
        status: 'completed',
      },
    });

    // Calculate metrics
    const totalDeals = deals.length;
    const successRate = swarm.agents.length > 0 ? (totalDeals / swarm.agents.length) * 100 : 0;

    let avgNegotiationTime = 0;
    if (deals.length > 0) {
      const totalTime = deals.reduce((sum, deal) => {
        if (deal.completedAt && deal.lockedAt) {
          return sum + (deal.completedAt.getTime() - deal.lockedAt.getTime());
        }
        return sum;
      }, 0);
      avgNegotiationTime = totalTime / deals.length / 1000; // Convert to seconds
    }

    // Strategy performance
    const strategyPerformance = {} as Record<string, { deals: number; avgPrice: number }>;
    for (const agent of swarm.agents) {
      if (!strategyPerformance[agent.strategy]) {
        strategyPerformance[agent.strategy] = { deals: 0, avgPrice: 0 };
      }
      const agentDeals = deals.filter(
        (d) => d.buyerAgentId === agent.id || d.sellerAgentId === agent.id,
      );
      strategyPerformance[agent.strategy].deals += agentDeals.length;
    }

    return {
      totalDeals,
      successRate: Math.round(successRate * 100) / 100,
      avgNegotiationTime: Math.round(avgNegotiationTime),
      activeAgents: swarm.agents.filter((a) => a.status === 'active').length,
      completedAgents: swarm.agents.filter((a) => a.status === 'completed').length,
      strategyPerformance,
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
