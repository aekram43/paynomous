import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private pubClient: Redis;
  private subClient: Redis;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      };

      // Main Redis client for caching and data operations
      this.client = new Redis(redisConfig);

      // Pub/Sub clients (separate connections required for Redis Pub/Sub)
      this.pubClient = new Redis(redisConfig);
      this.subClient = new Redis(redisConfig);

      this.client.on('connect', () => {
        this.logger.log('Redis client connected');
      });

      this.client.on('error', (error) => {
        this.logger.error('Redis client error:', error);
      });

      this.pubClient.on('error', (error) => {
        this.logger.error('Redis pub client error:', error);
      });

      this.subClient.on('error', (error) => {
        this.logger.error('Redis sub client error:', error);
      });

      this.logger.log('Redis service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  private async disconnect() {
    try {
      await this.client?.quit();
      await this.pubClient?.quit();
      await this.subClient?.quit();
      this.logger.log('Redis connections closed');
    } catch (error) {
      this.logger.error('Error disconnecting from Redis:', error);
    }
  }

  // ============================================================================
  // NFT Metadata Caching (1 hour TTL)
  // ============================================================================

  async cacheNftMetadata(nftId: string, metadata: any): Promise<void> {
    try {
      const key = `nft:metadata:${nftId}`;
      const ttl = 3600; // 1 hour in seconds
      await this.client.setex(key, ttl, JSON.stringify(metadata));
      this.logger.debug(`Cached NFT metadata for ${nftId}`);
    } catch (error) {
      this.logger.error(`Failed to cache NFT metadata for ${nftId}:`, error);
    }
  }

  async getNftMetadata(nftId: string): Promise<any | null> {
    try {
      const key = `nft:metadata:${nftId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get NFT metadata for ${nftId}:`, error);
      return null;
    }
  }

  // ============================================================================
  // User Session Caching (24 hour TTL)
  // ============================================================================

  async cacheUserSession(userId: string, sessionData: any): Promise<void> {
    try {
      const key = `user:session:${userId}`;
      const ttl = 86400; // 24 hours in seconds
      await this.client.setex(key, ttl, JSON.stringify(sessionData));
      this.logger.debug(`Cached user session for ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to cache user session for ${userId}:`, error);
    }
  }

  async getUserSession(userId: string): Promise<any | null> {
    try {
      const key = `user:session:${userId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get user session for ${userId}:`, error);
      return null;
    }
  }

  async deleteUserSession(userId: string): Promise<void> {
    try {
      const key = `user:session:${userId}`;
      await this.client.del(key);
      this.logger.debug(`Deleted user session for ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete user session for ${userId}:`, error);
    }
  }

  // ============================================================================
  // Live Stats - Sorted Sets for Floor Prices and Bids
  // ============================================================================

  async updateRoomFloorPrice(roomId: string, nftId: string, price: number): Promise<void> {
    try {
      const key = `room:${roomId}:floor`;
      await this.client.zadd(key, price, nftId);
      this.logger.debug(`Updated floor price for room ${roomId}: ${nftId} = ${price}`);
    } catch (error) {
      this.logger.error(`Failed to update floor price for room ${roomId}:`, error);
    }
  }

  async getRoomFloorPrice(roomId: string): Promise<{ nftId: string; price: number } | null> {
    try {
      const key = `room:${roomId}:floor`;
      const result = await this.client.zrange(key, 0, 0, 'WITHSCORES');

      if (result.length === 0) {
        return null;
      }

      return {
        nftId: result[0],
        price: parseFloat(result[1]),
      };
    } catch (error) {
      this.logger.error(`Failed to get floor price for room ${roomId}:`, error);
      return null;
    }
  }

  async updateRoomBid(roomId: string, agentId: string, bidAmount: number): Promise<void> {
    try {
      const key = `room:${roomId}:bids`;
      await this.client.zadd(key, bidAmount, agentId);
      this.logger.debug(`Updated bid for room ${roomId}: ${agentId} = ${bidAmount}`);
    } catch (error) {
      this.logger.error(`Failed to update bid for room ${roomId}:`, error);
    }
  }

  async getRoomTopBid(roomId: string): Promise<{ agentId: string; bidAmount: number } | null> {
    try {
      const key = `room:${roomId}:bids`;
      // Get highest score (reverse order)
      const result = await this.client.zrevrange(key, 0, 0, 'WITHSCORES');

      if (result.length === 0) {
        return null;
      }

      return {
        agentId: result[0],
        bidAmount: parseFloat(result[1]),
      };
    } catch (error) {
      this.logger.error(`Failed to get top bid for room ${roomId}:`, error);
      return null;
    }
  }

  async getRoomBids(roomId: string, limit: number = 10): Promise<Array<{ agentId: string; bidAmount: number }>> {
    try {
      const key = `room:${roomId}:bids`;
      const result = await this.client.zrevrange(key, 0, limit - 1, 'WITHSCORES');

      const bids: Array<{ agentId: string; bidAmount: number }> = [];
      for (let i = 0; i < result.length; i += 2) {
        bids.push({
          agentId: result[i],
          bidAmount: parseFloat(result[i + 1]),
        });
      }

      return bids;
    } catch (error) {
      this.logger.error(`Failed to get bids for room ${roomId}:`, error);
      return [];
    }
  }

  // Helper methods for AgentDecisionService

  /**
   * Batch update floor prices for multiple agents using Redis pipeline
   * Much more efficient than individual updateFloorPrice calls
   */
  async batchUpdateFloorPrices(roomId: string, updates: Array<{ agentId: string; price: number }>): Promise<void> {
    try {
      if (updates.length === 0) return;

      const key = `room:${roomId}:floor`;
      const pipeline = this.client.pipeline();

      for (const update of updates) {
        pipeline.zadd(key, update.price, update.agentId);
      }

      await pipeline.exec();
      this.logger.debug(`Batch updated ${updates.length} floor prices for room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to batch update floor prices for room ${roomId}:`, error);
    }
  }

  /**
   * Batch update bids for multiple agents using Redis pipeline
   * Much more efficient than individual updateTopBid calls
   */
  async batchUpdateBids(roomId: string, updates: Array<{ agentId: string; bid: number }>): Promise<void> {
    try {
      if (updates.length === 0) return;

      const key = `room:${roomId}:bids`;
      const pipeline = this.client.pipeline();

      for (const update of updates) {
        pipeline.zadd(key, update.bid, update.agentId);
      }

      await pipeline.exec();
      this.logger.debug(`Batch updated ${updates.length} bids for room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to batch update bids for room ${roomId}:`, error);
    }
  }

  async getFloorPrice(roomId: string): Promise<number | null> {
    try {
      const key = `room:${roomId}:floor`;
      const result = await this.client.zrange(key, 0, 0, 'WITHSCORES');

      if (result.length === 0) {
        return null;
      }

      return parseFloat(result[1]);
    } catch (error) {
      this.logger.error(`Failed to get floor price for room ${roomId}:`, error);
      return null;
    }
  }

  async getTopBid(roomId: string): Promise<number | null> {
    try {
      const key = `room:${roomId}:bids`;
      const result = await this.client.zrevrange(key, 0, 0, 'WITHSCORES');

      if (result.length === 0) {
        return null;
      }

      return parseFloat(result[1]);
    } catch (error) {
      this.logger.error(`Failed to get top bid for room ${roomId}:`, error);
      return null;
    }
  }

  async updateFloorPrice(roomId: string, agentId: string, price: number): Promise<void> {
    try {
      const key = `room:${roomId}:floor`;
      await this.client.zadd(key, price, agentId);
      this.logger.debug(`Updated floor price for room ${roomId}: ${agentId} = ${price}`);
    } catch (error) {
      this.logger.error(`Failed to update floor price for room ${roomId}:`, error);
    }
  }

  async updateTopBid(roomId: string, agentId: string, bid: number): Promise<void> {
    try {
      const key = `room:${roomId}:bids`;
      await this.client.zadd(key, bid, agentId);
      this.logger.debug(`Updated top bid for room ${roomId}: ${agentId} = ${bid}`);
    } catch (error) {
      this.logger.error(`Failed to update top bid for room ${roomId}:`, error);
    }
  }

  async removeAgentFromFloor(roomId: string, agentId: string): Promise<void> {
    try {
      const key = `room:${roomId}:floor`;
      await this.client.zrem(key, agentId);
      this.logger.debug(`Removed agent ${agentId} from floor in room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to remove agent from floor:`, error);
    }
  }

  async removeAgentFromBids(roomId: string, agentId: string): Promise<void> {
    try {
      const key = `room:${roomId}:bids`;
      await this.client.zrem(key, agentId);
      this.logger.debug(`Removed agent ${agentId} from bids in room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to remove agent from bids:`, error);
    }
  }

  // ============================================================================
  // Room Stats Caching (5 second TTL)
  // ============================================================================

  async cacheRoomStats(roomId: string, stats: any): Promise<void> {
    try {
      const key = `room:${roomId}:stats`;
      const ttl = 5; // 5 seconds
      await this.client.setex(key, ttl, JSON.stringify(stats));
      this.logger.debug(`Cached stats for room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to cache stats for room ${roomId}:`, error);
    }
  }

  async getRoomStats(roomId: string): Promise<any | null> {
    try {
      const key = `room:${roomId}:stats`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get stats for room ${roomId}:`, error);
      return null;
    }
  }

  // ============================================================================
  // Rate Limiting Counters
  // ============================================================================

  async incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
    try {
      const rateLimitKey = `ratelimit:${key}`;
      const pipeline = this.client.pipeline();

      pipeline.incr(rateLimitKey);
      pipeline.expire(rateLimitKey, windowSeconds);

      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number;

      return count;
    } catch (error) {
      this.logger.error(`Failed to increment rate limit for ${key}:`, error);
      return 0;
    }
  }

  async getRateLimitCount(key: string): Promise<number> {
    try {
      const rateLimitKey = `ratelimit:${key}`;
      const count = await this.client.get(rateLimitKey);
      return count ? parseInt(count) : 0;
    } catch (error) {
      this.logger.error(`Failed to get rate limit count for ${key}:`, error);
      return 0;
    }
  }

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
      const count = await this.incrementRateLimit(key, windowSeconds);
      return count <= limit;
    } catch (error) {
      this.logger.error(`Failed to check rate limit for ${key}:`, error);
      return true; // Allow on error
    }
  }

  // ============================================================================
  // WebSocket Session Tracking
  // ============================================================================

  async trackWebSocketSession(sessionId: string, sessionData: any): Promise<void> {
    try {
      const key = `ws:session:${sessionId}`;
      const ttl = 86400; // 24 hours
      await this.client.setex(key, ttl, JSON.stringify(sessionData));
      this.logger.debug(`Tracked WebSocket session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to track WebSocket session ${sessionId}:`, error);
    }
  }

  async getWebSocketSession(sessionId: string): Promise<any | null> {
    try {
      const key = `ws:session:${sessionId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get WebSocket session ${sessionId}:`, error);
      return null;
    }
  }

  async deleteWebSocketSession(sessionId: string): Promise<void> {
    try {
      const key = `ws:session:${sessionId}`;
      await this.client.del(key);
      this.logger.debug(`Deleted WebSocket session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to delete WebSocket session ${sessionId}:`, error);
    }
  }

  async refreshWebSocketSession(sessionId: string, ttl: number = 86400): Promise<void> {
    try {
      const key = `ws:session:${sessionId}`;
      await this.client.expire(key, ttl);
      this.logger.debug(`Refreshed WebSocket session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to refresh WebSocket session ${sessionId}:`, error);
    }
  }

  // ============================================================================
  // Pub/Sub for Room Updates
  // ============================================================================

  async publishRoomUpdate(roomId: string, event: string, data: any): Promise<void> {
    try {
      const channel = `room:${roomId}`;
      const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
      await this.pubClient.publish(channel, message);
      this.logger.debug(`Published ${event} to room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to publish to room ${roomId}:`, error);
    }
  }

  async subscribeToRoom(roomId: string, callback: (event: string, data: any) => void): Promise<void> {
    try {
      const channel = `room:${roomId}`;

      await this.subClient.subscribe(channel);

      this.subClient.on('message', (ch, message) => {
        if (ch === channel) {
          try {
            const parsed = JSON.parse(message);
            callback(parsed.event, parsed.data);
          } catch (error) {
            this.logger.error(`Failed to parse message from ${channel}:`, error);
          }
        }
      });

      this.logger.log(`Subscribed to room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to room ${roomId}:`, error);
    }
  }

  async unsubscribeFromRoom(roomId: string): Promise<void> {
    try {
      const channel = `room:${roomId}`;
      await this.subClient.unsubscribe(channel);
      this.logger.log(`Unsubscribed from room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from room ${roomId}:`, error);
    }
  }

  // ============================================================================
  // General Purpose Methods
  // ============================================================================

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const data = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, data);
      } else {
        await this.client.set(key, data);
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;

      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error);
      return false;
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
