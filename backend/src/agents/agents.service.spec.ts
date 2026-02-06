import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { RedisService } from '../redis/redis.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { PrismaClient } from '@prisma/client';

describe('AgentsService', () => {
  let service: AgentsService;
  let prisma: PrismaClient;

  const mockRedisService = {
    updateFloorPrice: jest.fn(),
    updateTopBid: jest.fn(),
    removeAgentFromFloor: jest.fn(),
    removeAgentFromBids: jest.fn(),
  };

  const mockWebsocketGateway = {
    broadcastAgentJoined: jest.fn(),
    broadcastAgentLeft: jest.fn(),
  };

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Clean up test data
    await prisma.agent.deleteMany({});
    await prisma.nft.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.agent.deleteMany({});
    await prisma.nft.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  // No afterEach cleanup - tests create unique data with beforeEach


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: WebsocketGateway,
          useValue: mockWebsocketGateway,
        },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);

    jest.clearAllMocks();
  });

  describe('spawnAgent', () => {
    let testUser: any;
    let testRoom: any;
    let testNft: any;
    let uniqueId = 0;

    beforeEach(async () => {
      uniqueId++;

      // Create test user with unique wallet address
      testUser = await prisma.user.create({
        data: {
          walletAddress: `0xTestUser${uniqueId}`,
        },
      });

      // Create test room
      testRoom = await prisma.room.create({
        data: {
          name: `Test Room ${uniqueId}`,
          collection: `Test Collection ${uniqueId}`,
        },
      });

      // Create test NFT
      testNft = await prisma.nft.create({
        data: {
          tokenId: `${uniqueId}`,
          name: `Test NFT ${uniqueId}`,
          collection: `Test Collection ${uniqueId}`,
          imageUrl: 'https://example.com/image.png',
        },
      });
    });

    afterEach(async () => {
      // Clean up after each test
      await prisma.agent.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.nft.deleteMany({
        where: { id: testNft.id },
      });
      await prisma.room.deleteMany({
        where: { id: testRoom.id },
      });
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
    });

    it('should spawn a buyer agent successfully', async () => {
      const spawnDto = {
        roomId: testRoom.id,
        name: 'Test Buyer Agent',
        role: 'buyer' as const,
        minPrice: 40,
        maxPrice: 60,
        startingPrice: 45,
        strategy: 'competitive' as const,
        personality: 'casual' as const,
        avatar: '🤖',
      };

      const result = await service.spawnAgent(testUser.id, spawnDto);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(spawnDto.name);
      expect(result.role).toBe('buyer');
      expect(result.status).toBe('active');
      expect(result.strategy).toBe(spawnDto.strategy);
      expect(result.personality).toBe(spawnDto.personality);
      expect(result.currentPrice).toEqual(String(spawnDto.startingPrice));
      expect(result.room.id).toBe(testRoom.id);
      expect(result.owner).toBe(testUser.walletAddress);

      // Verify Redis was called
      expect(mockRedisService.updateTopBid).toHaveBeenCalledWith(
        testRoom.id,
        result.id,
        45,
      );

      // Verify WebSocket broadcast
      expect(mockWebsocketGateway.broadcastAgentJoined).toHaveBeenCalledWith(
        testRoom.id,
        expect.objectContaining({
          id: result.id,
          name: spawnDto.name,
          role: 'buyer',
        }),
      );
    });

    it('should spawn a seller agent successfully', async () => {
      const spawnDto = {
        roomId: testRoom.id,
        name: 'Test Seller Agent',
        role: 'seller' as const,
        nftId: testNft.id,
        minPrice: 40,
        maxPrice: 60,
        startingPrice: 55,
        strategy: 'patient' as const,
        personality: 'formal' as const,
        avatar: '🦊',
      };

      const result = await service.spawnAgent(testUser.id, spawnDto);

      expect(result).toBeDefined();
      expect(result.role).toBe('seller');
      expect(result.currentPrice).toEqual(String(spawnDto.startingPrice));

      // Verify Redis was called for floor price
      expect(mockRedisService.updateFloorPrice).toHaveBeenCalledWith(
        testRoom.id,
        result.id,
        55,
      );
    });

    it('should throw NotFoundException when room does not exist', async () => {
      const spawnDto = {
        roomId: '00000000-0000-0000-0000-000000000001',
        name: 'Test Agent',
        role: 'buyer' as const,
        minPrice: 40,
        maxPrice: 60,
        startingPrice: 45,
        strategy: 'competitive' as const,
        personality: 'casual' as const,
      };

      await expect(service.spawnAgent(testUser.id, spawnDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when seller agent has no NFT ID', async () => {
      const spawnDto = {
        roomId: testRoom.id,
        name: 'Test Seller Agent',
        role: 'seller' as const,
        nftId: undefined,
        minPrice: 40,
        maxPrice: 60,
        startingPrice: 55,
        strategy: 'patient' as const,
        personality: 'formal' as const,
      };

      await expect(service.spawnAgent(testUser.id, spawnDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when NFT does not exist', async () => {
      const spawnDto = {
        roomId: testRoom.id,
        name: 'Test Seller Agent',
        role: 'seller' as const,
        nftId: '00000000-0000-0000-0000-000000000002',
        minPrice: 40,
        maxPrice: 60,
        startingPrice: 55,
        strategy: 'patient' as const,
        personality: 'formal' as const,
      };

      await expect(service.spawnAgent(testUser.id, spawnDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use default avatar when none provided', async () => {
      const spawnDto = {
        roomId: testRoom.id,
        name: 'Test Agent',
        role: 'buyer' as const,
        minPrice: 40,
        maxPrice: 60,
        startingPrice: 45,
        strategy: 'competitive' as const,
        personality: 'casual' as const,
      };

      const result = await service.spawnAgent(testUser.id, spawnDto);

      // Avatar defaults to 🤖 in the service
      const agent = await prisma.agent.findUnique({
        where: { id: result.id },
      });

      expect(agent?.avatar).toBe('🤖');
    });
  });

  describe('findOne', () => {
    let testAgent: any;
    let testUser: any;
    let testRoom: any;
    let uniqueId = 0;

    beforeEach(async () => {
      uniqueId++;

      testUser = await prisma.user.create({
        data: {
          walletAddress: `0xTestUserFindOne${uniqueId}`,
        },
      });

      testRoom = await prisma.room.create({
        data: {
          name: `Test Room FindOne ${uniqueId}`,
          collection: `Test Collection FindOne ${uniqueId}`,
        },
      });

      testAgent = await prisma.agent.create({
        data: {
          name: `Test Agent FindOne ${uniqueId}`,
          role: 'buyer',
          status: 'active',
          strategy: 'competitive',
          communicationStyle: 'casual',
          minPrice: 40,
          maxPrice: 60,
          startingPrice: 45,
          messagesSent: 5,
          avatar: '🤖',
          userId: testUser.id,
          roomId: testRoom.id,
        },
      });
    });

    afterEach(async () => {
      // Clean up after each test
      await prisma.nft.deleteMany({
        where: { collection: `Test Collection FindOne ${uniqueId}` },
      });
      await prisma.agent.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.room.deleteMany({
        where: { id: testRoom.id },
      });
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
    });

    it('should return agent details when found', async () => {
      const result = await service.findOne(testAgent.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testAgent.id);
      expect(result?.name).toBe(`Test Agent FindOne ${uniqueId}`);
      expect(result?.role).toBe('buyer');
      expect(result?.status).toBe('active');
      expect(result?.strategy).toBe('competitive');
      expect(result?.personality).toBe('casual');
      expect(result?.currentPrice).toBe('45');
      expect(result?.minPrice).toBe(40);
      expect(result?.maxPrice).toBe(60);
      expect(result?.messageCount).toBe(5);
      expect(result?.room.id).toBe(testRoom.id);
      expect(result?.owner).toBe(testUser.walletAddress);
      expect(result?.nft).toBeNull();
    });

    it('should return null when agent not found', async () => {
      const result = await service.findOne('00000000-0000-0000-0000-000000000003');
      expect(result).toBeNull();
    });

    it('should include NFT details when agent has an NFT', async () => {
      const testNft = await prisma.nft.create({
        data: {
          tokenId: '456',
          name: `Test NFT 2 ${uniqueId}`,
          collection: `Test Collection 2 ${uniqueId}`,
          imageUrl: 'https://example.com/image2.png',
        },
      });

      await prisma.agent.update({
        where: { id: testAgent.id },
        data: { nftId: testNft.id },
      });

      const result = await service.findOne(testAgent.id);

      expect(result?.nft).toBeDefined();
      expect(result?.nft?.id).toBe(testNft.id);
      expect(result?.nft?.tokenId).toBe('456');
      expect(result?.nft?.imageUrl).toBe('https://example.com/image2.png');
    });
  });

  describe('deleteAgent', () => {
    let testAgent: any;
    let testUser: any;
    let testRoom: any;
    let uniqueId = 0;

    beforeEach(async () => {
      uniqueId++;

      testUser = await prisma.user.create({
        data: {
          walletAddress: `0xTestUserDelete${uniqueId}`,
        },
      });

      testRoom = await prisma.room.create({
        data: {
          name: `Test Room Delete ${uniqueId}`,
          collection: `Test Collection Delete ${uniqueId}`,
        },
      });

      testAgent = await prisma.agent.create({
        data: {
          name: `Test Agent Delete ${uniqueId}`,
          role: 'buyer',
          status: 'active',
          strategy: 'competitive',
          communicationStyle: 'casual',
          minPrice: 40,
          maxPrice: 60,
          startingPrice: 45,
          messagesSent: 0,
          avatar: '🤖',
          userId: testUser.id,
          roomId: testRoom.id,
        },
      });
    });

    afterEach(async () => {
      // Clean up after each test
      await prisma.agent.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
      await prisma.room.deleteMany({
        where: { id: testRoom.id },
      });
    });

    it('should delete agent successfully when owner', async () => {
      const result = await service.deleteAgent(testAgent.id, testUser.id);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Agent deleted successfully');

      // Verify agent is deleted
      const deletedAgent = await prisma.agent.findUnique({
        where: { id: testAgent.id },
      });
      expect(deletedAgent).toBeNull();

      // Verify Redis was called
      expect(mockRedisService.removeAgentFromBids).toHaveBeenCalledWith(
        testRoom.id,
        testAgent.id,
      );

      // Verify WebSocket broadcast
      expect(mockWebsocketGateway.broadcastAgentLeft).toHaveBeenCalledWith(
        testRoom.id,
        expect.objectContaining({
          id: testAgent.id,
          reason: 'user_removed',
        }),
      );
    });

    it('should delete seller agent and remove from floor tracking', async () => {
      const sellerAgent = await prisma.agent.create({
        data: {
          name: 'Seller Agent',
          role: 'seller',
          status: 'active',
          strategy: 'patient',
          communicationStyle: 'formal',
          minPrice: 40,
          maxPrice: 60,
          startingPrice: 55,
          messagesSent: 0,
          avatar: '🤖',
          userId: testUser.id,
          roomId: testRoom.id,
        },
      });

      await service.deleteAgent(sellerAgent.id, testUser.id);

      expect(mockRedisService.removeAgentFromFloor).toHaveBeenCalledWith(
        testRoom.id,
        sellerAgent.id,
      );
    });

    it('should throw NotFoundException when agent does not exist', async () => {
      await expect(
        service.deleteAgent('00000000-0000-0000-0000-000000000004', testUser.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user does not own the agent', async () => {
      const anotherUser = await prisma.user.create({
        data: {
          walletAddress: `0xAnotherUser${Date.now()}`,
        },
      });

      await expect(
        service.deleteAgent(testAgent.id, anotherUser.id),
      ).rejects.toThrow(BadRequestException);

      // Clean up anotherUser
      await prisma.user.delete({
        where: { id: anotherUser.id },
      });
    });

    it('should throw BadRequestException when agent status is locked', async () => {
      await prisma.agent.update({
        where: { id: testAgent.id },
        data: { status: 'locked' },
      });

      await expect(
        service.deleteAgent(testAgent.id, testUser.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when agent status is completed', async () => {
      await prisma.agent.update({
        where: { id: testAgent.id },
        data: { status: 'completed' },
      });

      await expect(
        service.deleteAgent(testAgent.id, testUser.id),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
