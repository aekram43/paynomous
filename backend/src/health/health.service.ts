import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { RustService } from '../rust/rust.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    database: { status: string; latency?: number; error?: string };
    redis: { status: string; latency?: number; error?: string };
    rustService: { status: string; latency?: number; error?: string };
    queues: {
      name: string;
      status: string;
      jobCounts: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
      };
    }[];
  };
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly prisma: PrismaClient;
  private startTime: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly rustService: RustService,
    @InjectQueue('glm-requests') private readonly glmQueue: Queue,
    @InjectQueue('deal-verification') private readonly verificationQueue: Queue,
    @InjectQueue('analytics') private readonly analyticsQueue: Queue,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {
    this.prisma = new PrismaClient();
    this.startTime = Date.now();
  }

  /**
   * Basic health check - returns immediately without external checks
   */
  async getBasicHealth(): Promise<{ status: string; timestamp: string; uptime: number }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Detailed health check with all service statuses
   */
  async getDetailedHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    // Check all services in parallel
    const [dbHealth, redisHealth, rustHealth, queueHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkRustService(),
      this.checkQueues(),
    ]);

    // Determine overall status
    const allServices = [dbHealth, redisHealth, rustHealth];
    const hasUnhealthy = allServices.some((s) => s.status === 'unhealthy');
    const hasDegraded = allServices.some((s) => s.status === 'degraded');

    const overallStatus: 'healthy' | 'unhealthy' | 'degraded' = hasUnhealthy
      ? 'unhealthy'
      : hasDegraded
        ? 'degraded'
        : 'healthy';

    // Get memory usage
    const memory = process.memoryUsage();
    const totalMemory = memory.heapTotal;
    const usedMemory = memory.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        redis: redisHealth,
        rustService: rustHealth,
        queues: queueHealth,
      },
      uptime: Date.now() - this.startTime,
      memory: {
        used: Math.round(usedMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage * 100) / 100,
      },
    };
  }

  /**
   * Readiness probe - checks if service can accept traffic
   */
  async getReadiness(): Promise<{ status: string; timestamp: string }> {
    // Basic check: are critical dependencies available?
    try {
      // Quick Redis check
      const redisClient = this.redisService.getClient();
      if (!redisClient) {
        throw new Error('Redis client not available');
      }

      // Quick DB check (just verify connection exists, don't query)
      if (!this.prisma) {
        throw new Error('Database client not available');
      }

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Readiness check failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Liveness probe - checks if service is alive
   */
  async getLiveness(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<{ status: string; latency?: number; error?: string }> {
    const startTime = Date.now();
    try {
      // Simple query to check connection
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      // Consider degraded if latency > 500ms
      if (latency > 500) {
        return { status: 'degraded', latency };
      }

      return { status: 'healthy', latency };
    } catch (error) {
      this.logger.error(`Database health check failed: ${error.message}`);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedis(): Promise<{ status: string; latency?: number; error?: string }> {
    const startTime = Date.now();
    try {
      const client = this.redisService.getClient();
      await client.ping();
      const latency = Date.now() - startTime;

      // Consider degraded if latency > 100ms
      if (latency > 100) {
        return { status: 'degraded', latency };
      }

      return { status: 'healthy', latency };
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error.message}`);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Check Rust service health
   */
  private async checkRustService(): Promise<{ status: string; latency?: number; error?: string }> {
    const startTime = Date.now();
    try {
      const isHealthy = await this.rustService.healthCheck();
      const latency = Date.now() - startTime;

      if (!isHealthy) {
        return { status: 'unhealthy', error: 'Rust service reported unhealthy status' };
      }

      // Consider degraded if latency > 200ms
      if (latency > 200) {
        return { status: 'degraded', latency };
      }

      return { status: 'healthy', latency };
    } catch (error) {
      this.logger.error(`Rust service health check failed: ${error.message}`);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Check all BullMQ queues
   */
  private async checkQueues(): Promise<{
    name: string;
    status: string;
    jobCounts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  }[]> {
    const queues = [
      { queue: this.glmQueue, name: 'glm-requests' },
      { queue: this.verificationQueue, name: 'deal-verification' },
      { queue: this.analyticsQueue, name: 'analytics' },
      { queue: this.cleanupQueue, name: 'cleanup' },
      { queue: this.notificationsQueue, name: 'notifications' },
    ];

    const results = await Promise.allSettled(
      queues.map(async ({ queue, name }) => {
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
        return {
          name,
          status: 'healthy',
          jobCounts: {
            waiting: counts.waiting || 0,
            active: counts.active || 0,
            completed: counts.completed || 0,
            failed: counts.failed || 0,
          },
        };
      }),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      this.logger.error(`Queue ${queues[index].name} health check failed: ${result.reason.message}`);
      return {
        name: queues[index].name,
        status: 'unhealthy',
        jobCounts: { waiting: 0, active: 0, completed: 0, failed: 0 },
      };
    });
  }
}
