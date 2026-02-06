import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { RedisService } from '../redis/redis.service';
import { PrismaClient } from '@prisma/client';

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: PrismaClient;

  const mockRedisService = {
    getRoomStats: jest.fn(),
    cacheRoomStats: jest.fn(),
  };

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Clean up test data
    await prisma.agent.deleteMany({});
    await prisma.deal.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.agent.deleteMany({});
    await prisma.deal.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  // No afterEach cleanup - tests create unique data with beforeEach


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return an empty array when no rooms exist', async () => {
      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should return all rooms with agent counts', async () => {
      const testUser = await prisma.user.create({
        data: {
          walletAddress: '0xTestUser',
        },
      });

      const room1 = await prisma.room.create({
        data: {
          name: 'Test Room 1',
          collection: 'Test Collection',
          status: 'active',
        },
      });

      const room2 = await prisma.room.create({
        data: {
          name: 'Test Room 2',
          collection: 'Test Collection',
          status: 'waiting',
        },
      });

      // Add agents to room1
      await prisma.agent.create({
        data: {
          name: 'Agent 1',
          role: 'buyer',
          status: 'active',
          strategy: 'competitive',
          communicationStyle: 'casual',
          minPrice: 40,
          maxPrice: 60,
          startingPrice: 45,
          userId: testUser.id,
          roomId: room1.id,
        },
      });

      await prisma.agent.create({
        data: {
          name: 'Agent 2',
          role: 'seller',
          status: 'active',
          strategy: 'patient',
          communicationStyle: 'formal',
          minPrice: 40,
          maxPrice: 60,
          startingPrice: 55,
          userId: testUser.id,
          roomId: room1.id,
        },
      });

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(room1.id);
      expect(result[0].name).toBe('Test Room 1');
      expect(result[0].activeAgentsCount).toBe(2);
      expect(result[1].id).toBe(room2.id);
      expect(result[1].name).toBe('Test Room 2');
      expect(result[1].activeAgentsCount).toBe(0);
    });
  });

  describe('findOne', () => {
    let testRoom: any;
    let testUser: any;

    beforeEach(async () => {
      // Generate unique wallet address for this test
      const uniqueSuffix = Date.now() + Math.random().toString(36).substring(7);
      testUser = await prisma.user.create({
        data: {
          walletAddress: `0xTestUser2_${uniqueSuffix}`,
        },
      });

      testRoom = await prisma.room.create({
        data: {
          name: `Test Room_${uniqueSuffix}`,
          collection: 'Test Collection',
          status: 'active',
        },
      });
    });

    it('should return room details when found', async () => {
      const result = await service.findOne(testRoom.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testRoom.id);
      expect(result?.name).toBe('Test Room');
      expect(result?.collection).toBe('Test Collection');
      expect(result?.status).toBe('active');
      expect(result?.activeAgentsCount).toBe(0);
      expect(result?.totalDeals).toBe(0);
      expect(result?.agents).toEqual([]);
    });

    it('should return null when room not found', async () => {
      const result = await service.findOne('00000000-0000-0000-0000-000000000001');
      expect(result).toBeNull();
    });

    it('should include agents in the room', async () => {
      await prisma.agent.create({
        data: {
          name: 'Test Agent',
          role: 'buyer',
          status: 'active',
          strategy: 'competitive',
          communicationStyle: 'casual',
          minPrice: 40,
          maxPrice: 60,
          startingPrice: 45,
          userId: testUser.id,
          roomId: testRoom.id,
        },
      });

      const result = await service.findOne(testRoom.id);

      expect(result?.agents).toHaveLength(1);
      expect(result?.agents[0].name).toBe('Test Agent');
      expect(result?.agents[0].role).toBe('buyer');
      expect(result?.agents[0].owner).toBe(testUser.walletAddress);
    });
  });

  describe('getStats', () => {
    let testRoom: any;
    let testUser: any;

    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          walletAddress: '0xTestUser3',
        },
      });

      testRoom = await prisma.room.create({
        data: {
          name: 'Test Room Stats',
          collection: 'Test Collection',
          status: 'active',
        },
      });
    });

    it('should return null when room not found', async () => {
      const result = await service.getStats('00000000-0000-0000-0000-000000000002');
      expect(result).toBeNull();
    });

    it('should return cached stats if available', async () => {
      const cachedStats = {
        activeAgents: 5,
        activeBuyers: 3,
        activeSellers: 2,
        totalDeals: 10,
        recentDeals: [],
      };

      mockRedisService.getRoomStats.mockResolvedValue(cachedStats);

      const result = await service.getStats(testRoom.id);

      expect(result).toEqual(cachedStats);
      expect(mockRedisService.getRoomStats).toHaveBeenCalledWith(testRoom.id);
      expect(mockRedisService.cacheRoomStats).not.toHaveBeenCalled();
    });

    it('should fetch and cache stats when not cached', async () => {
      mockRedisService.getRoomStats.mockResolvedValue(null);

      // Create active agents
      await prisma.agent.create({
        data: {
          name: 'Buyer Agent',
          role: 'buyer',
          status: 'active',
          strategy: 'competitive',
          communicationStyle: 'casual',
          minPrice: 40,
          maxPrice: 60,
          startingPrice: 45,
          userId: testUser.id,
          roomId: testRoom.id,
        },
      });

      await prisma.agent.create({
        data: {
          name: 'Seller Agent',
          role: 'seller',
          status: 'active',
          strategy: 'patient',
          communicationStyle: 'formal',
          minPrice: 40,
          maxPrice: 60,
          startingPrice: 55,
          userId: testUser.id,
          roomId: testRoom.id,
        },
      });

      const result = await service.getStats(testRoom.id);

      expect(result?.activeAgents).toBe(2);
      expect(result?.activeBuyers).toBe(1);
      expect(result?.activeSellers).toBe(1);
      expect(result?.totalDeals).toBe(0);
      expect(result?.recentDeals).toEqual([]);
      expect(mockRedisService.cacheRoomStats).toHaveBeenCalledWith(
        testRoom.id,
        expect.any(Object),
      );
    });

    it('should only count active agents in stats', async () => {
      mockRedisService.getRoomStats.mockResolvedValue(null);

      // Create active and inactive agents
      await prisma.agent.create({
        data: {
          name: 'Active Agent',
          role: 'buyer',
          status: 'active',
          strategy: 'competitive',
          communicationStyle: 'casual',
          minPrice: 40,
          maxPrice: 60,
          startingPrice: 45,
          userId: testUser.id,
          roomId: testRoom.id,
        },
      });

      await prisma.agent.create({
        data: {
          name: 'Inactive Agent',
          role: 'buyer',
          status: 'completed',
          strategy: 'competitive',
          communicationStyle: 'casual',
          minPrice: 40,
          maxPrice: 60,
          startingPrice: 45,
          userId: testUser.id,
          roomId: testRoom.id,
        },
      });

      const result = await service.getStats(testRoom.id);

      expect(result?.activeAgents).toBe(1); // Only active agent
    });

  });
});
