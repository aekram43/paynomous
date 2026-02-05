import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { verifyMessage } from 'ethers';
import { RedisService } from '../redis/redis.service';

interface NonceStore {
  nonce: string;
  expiresAt: string;
}

@Injectable()
export class AuthService {
  private prisma: PrismaClient;

  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {
    this.prisma = new PrismaClient();
  }

  async generateChallenge(walletAddress: string) {
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store nonce in Redis with 5 minute TTL
    const nonceData: NonceStore = {
      nonce,
      expiresAt: expiresAt.toISOString(),
    };
    await this.redisService.set(`auth:nonce:${walletAddress.toLowerCase()}`, nonceData, 300);

    const message = `Welcome to Agentrooms!\n\nSign this message to authenticate your wallet.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`;

    return {
      nonce,
      message,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifySignature(walletAddress: string, signature: string, nonce: string) {
    const normalizedAddress = walletAddress.toLowerCase();

    // Get nonce from Redis
    const storedNonce = await this.redisService.get(`auth:nonce:${normalizedAddress}`) as NonceStore | null;
    if (!storedNonce) {
      throw new UnauthorizedException('No challenge found for this wallet address');
    }

    if (storedNonce.nonce !== nonce) {
      throw new UnauthorizedException('Invalid nonce');
    }

    if (new Date() > new Date(storedNonce.expiresAt)) {
      await this.redisService.del(`auth:nonce:${normalizedAddress}`);
      throw new UnauthorizedException('Challenge expired');
    }

    // Reconstruct the message that was signed
    const message = `Welcome to Agentrooms!\n\nSign this message to authenticate your wallet.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nExpires: ${storedNonce.expiresAt}`;

    try {
      // Verify the signature
      const recoveredAddress = verifyMessage(message, signature);

      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        throw new UnauthorizedException('Signature verification failed');
      }

      // Remove used nonce to prevent replay attacks
      await this.redisService.del(`auth:nonce:${normalizedAddress}`);

      // Create or update user in database
      let user = await this.prisma.user.findUnique({
        where: { walletAddress: normalizedAddress },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            walletAddress: normalizedAddress,
          },
        });
      } else {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { updatedAt: new Date() },
        });
      }

      // Generate JWT tokens
      const payload = { userId: user.id, walletAddress: user.walletAddress };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '24h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      // Cache user session (24 hour TTL)
      await this.redisService.cacheUserSession(user.id, {
        userId: user.id,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
        lastActivity: new Date().toISOString(),
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: 24 * 60 * 60, // 24 hours in seconds
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          createdAt: user.createdAt,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Signature verification failed: ' + error.message);
    }
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);

      // Verify user still exists
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new access token
      const newPayload = { userId: user.id, walletAddress: user.walletAddress };
      const accessToken = this.jwtService.sign(newPayload, { expiresIn: '24h' });

      return {
        accessToken,
        expiresIn: 24 * 60 * 60,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUserById(userId: string) {
    // Check cache first
    const cachedSession = await this.redisService.getUserSession(userId);
    if (cachedSession) {
      return {
        id: cachedSession.userId,
        walletAddress: cachedSession.walletAddress,
        createdAt: cachedSession.createdAt,
      };
    }

    // Fetch from database if not in cache
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Cache the session
    await this.redisService.cacheUserSession(user.id, {
      userId: user.id,
      walletAddress: user.walletAddress,
      createdAt: user.createdAt,
      lastActivity: new Date().toISOString(),
    });

    return {
      id: user.id,
      walletAddress: user.walletAddress,
      createdAt: user.createdAt,
    };
  }
}
