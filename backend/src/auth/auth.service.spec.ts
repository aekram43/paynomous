import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { PrismaClient } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { verifyMessage, Wallet } from 'ethers';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  // Test wallet - using ethers Wallet to generate a deterministic test wallet
  const testWallet = Wallet.createRandom();

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    cacheUserSession: jest.fn(),
    getUserSession: jest.fn(),
  };

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Clean up test data
    await prisma.user.deleteMany({
      where: { walletAddress: testWallet.address.toLowerCase() },
    });
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.user.deleteMany({
      where: { walletAddress: testWallet.address.toLowerCase() },
    });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up after each test - only clean up users from this test file
    await prisma.user.deleteMany({
      where: { walletAddress: testWallet.address.toLowerCase() },
    });
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('test-access-token'),
            verify: jest.fn().mockReturnValue({
              userId: 'test-user-id',
              walletAddress: testWallet.address.toLowerCase(),
            }),
          },
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('generateChallenge', () => {
    it('should generate a challenge with nonce and message', async () => {
      const result = await service.generateChallenge(testWallet.address);

      expect(result).toBeDefined();
      expect(result.nonce).toBeDefined();
      expect(result.nonce).toHaveLength(64); // 32 bytes as hex
      expect(result.message).toContain(testWallet.address);
      expect(result.message).toContain(result.nonce);
      expect(result.expiresAt).toBeDefined();
    });

    it('should store nonce in Redis with 5 minute TTL', async () => {
      await service.generateChallenge(testWallet.address);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        `auth:nonce:${testWallet.address.toLowerCase()}`,
        expect.objectContaining({
          nonce: expect.any(String),
          expiresAt: expect.any(String),
        }),
        300, // 5 minutes
      );
    });

    it('should generate unique nonces for each call', async () => {
      const result1 = await service.generateChallenge(testWallet.address);
      const result2 = await service.generateChallenge(testWallet.address);

      expect(result1.nonce).not.toBe(result2.nonce);
    });
  });

  describe('verifySignature', () => {
    let testNonce: string;
    let testMessage: string;
    let testSignature: string;
    let expiresAt: string;

    beforeEach(async () => {
      // Generate a real signature using ethers Wallet
      testNonce = randomBytes(32).toString('hex');
      expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      testMessage = `Welcome to Agentrooms!\n\nSign this message to authenticate your wallet.\n\nWallet: ${testWallet.address}\nNonce: ${testNonce}\nExpires: ${expiresAt}`;
      testSignature = await testWallet.signMessage(testMessage);
    });

    it('should verify signature and return tokens', async () => {
      const storedNonce = {
        nonce: testNonce,
        expiresAt: expiresAt, // Use the same expiresAt that was used to sign
      };

      mockRedisService.get.mockResolvedValue(storedNonce);

      const result = await service.verifySignature(
        testWallet.address,
        testSignature,
        testNonce,
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(24 * 60 * 60);
      expect(result.user).toBeDefined();
      expect(result.user.walletAddress).toBe(testWallet.address.toLowerCase());

      // Verify nonce was removed
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `auth:nonce:${testWallet.address.toLowerCase()}`,
      );
    });

    it('should create new user if not exists', async () => {
      const storedNonce = {
        nonce: testNonce,
        expiresAt: expiresAt, // Use the same expiresAt that was used to sign
      };

      mockRedisService.get.mockResolvedValue(storedNonce);

      await service.verifySignature(testWallet.address, testSignature, testNonce);

      const user = await prisma.user.findUnique({
        where: { walletAddress: testWallet.address.toLowerCase() },
      });

      expect(user).toBeDefined();
      expect(user?.walletAddress).toBe(testWallet.address.toLowerCase());
    });

    it('should update existing user if exists', async () => {
      // Create user first
      const existingUser = await prisma.user.create({
        data: {
          walletAddress: testWallet.address.toLowerCase(),
        },
      });

      const storedNonce = {
        nonce: testNonce,
        expiresAt: expiresAt, // Use the same expiresAt that was used to sign
      };

      mockRedisService.get.mockResolvedValue(storedNonce);

      await service.verifySignature(testWallet.address, testSignature, testNonce);

      expect(mockRedisService.cacheUserSession).toHaveBeenCalledWith(
        existingUser.id,
        expect.objectContaining({
          userId: existingUser.id,
          walletAddress: existingUser.walletAddress,
        }),
      );
    });

    it('should throw UnauthorizedException when no challenge found', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(
        service.verifySignature(testWallet.address, testSignature, testNonce),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifySignature(testWallet.address, testSignature, testNonce),
      ).rejects.toThrow('No challenge found for this wallet address');
    });

    it('should throw UnauthorizedException when nonce mismatch', async () => {
      const storedNonce = {
        nonce: 'different-nonce',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };

      mockRedisService.get.mockResolvedValue(storedNonce);

      await expect(
        service.verifySignature(testWallet.address, testSignature, testNonce),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifySignature(testWallet.address, testSignature, testNonce),
      ).rejects.toThrow('Invalid nonce');
    });

    it('should throw UnauthorizedException when challenge expired', async () => {
      const storedNonce = {
        nonce: testNonce,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired (different from signed)
      };

      mockRedisService.get.mockResolvedValue(storedNonce);

      await expect(
        service.verifySignature(testWallet.address, testSignature, testNonce),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifySignature(testWallet.address, testSignature, testNonce),
      ).rejects.toThrow('Challenge expired');

      // Verify expired nonce was removed
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `auth:nonce:${testWallet.address.toLowerCase()}`,
      );
    });

    it('should throw UnauthorizedException for invalid signature', async () => {
      const storedNonce = {
        nonce: testNonce,
        expiresAt: expiresAt, // Use the same expiresAt that was used to sign
      };

      mockRedisService.get.mockResolvedValue(storedNonce);

      const invalidSignature = '0x' + 'a'.repeat(130);

      await expect(
        service.verifySignature(
          testWallet.address,
          invalidSignature,
          testNonce,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token with valid refresh token', async () => {
      const testUser = await prisma.user.create({
        data: {
          walletAddress: testWallet.address.toLowerCase(),
        },
      });

      const mockPayload = {
        userId: testUser.id,
        walletAddress: testUser.walletAddress,
      };

      const mockVerify = jest.fn().mockReturnValue(mockPayload);
      (jwtService.verify as jest.Mock) = mockVerify;

      const mockSign = jest.fn().mockReturnValue('new-access-token');
      (jwtService.sign as jest.Mock) = mockSign;

      const result = await service.refreshAccessToken('valid-refresh-token');

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('new-access-token');
      expect(result.expiresIn).toBe(24 * 60 * 60);
      expect(mockVerify).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockSign).toHaveBeenCalledWith(mockPayload, { expiresIn: '24h' });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const mockVerify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });
      (jwtService.verify as jest.Mock) = mockVerify;

      await expect(
        service.refreshAccessToken('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshAccessToken('invalid-token'),
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('getUserById', () => {
    it('should return user from cache if available', async () => {
      const cachedSession = {
        userId: 'cached-user-id',
        walletAddress: testWallet.address.toLowerCase(),
        createdAt: new Date().toISOString(),
      };

      mockRedisService.getUserSession.mockResolvedValue(cachedSession);

      const result = await service.getUserById('cached-user-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('cached-user-id');
      expect(result.walletAddress).toBe(testWallet.address.toLowerCase());
      expect(mockRedisService.getUserSession).toHaveBeenCalledWith('cached-user-id');
    });

    it('should fetch user from database if not cached', async () => {
      const testUser = await prisma.user.create({
        data: {
          walletAddress: testWallet.address.toLowerCase(),
        },
      });

      mockRedisService.getUserSession.mockResolvedValue(null);

      const result = await service.getUserById(testUser.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(testUser.id);
      expect(result.walletAddress).toBe(testUser.walletAddress);

      // Verify session was cached
      expect(mockRedisService.cacheUserSession).toHaveBeenCalledWith(
        testUser.id,
        expect.objectContaining({
          userId: testUser.id,
          walletAddress: testUser.walletAddress,
        }),
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockRedisService.getUserSession.mockResolvedValue(null);

      await expect(
        service.getUserById('00000000-0000-0000-0000-000000000002'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.getUserById('00000000-0000-0000-0000-000000000002'),
      ).rejects.toThrow('User not found');
    });
  });
});

// Helper function to generate random nonce
function randomBytes(size: number): { toString: (encoding: 'hex') => string } {
  const crypto = require('crypto');
  return crypto.randomBytes(size);
}
