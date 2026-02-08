import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';

export interface Metrics {
  timestamp: string;
  api: {
    responseTimes: {
      p50: number;
      p95: number;
      p99: number;
      avg: number;
    };
    requestCount: number;
    errorRate: number;
  };
  queues: {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }[];
  agents: {
    active: number;
    total: number;
    byStatus: Record<string, number>;
  };
  deals: {
    total: number;
    completed: number;
    failed: number;
    completionRate: number;
    avgNegotiationTime: number;
  };
  rooms: {
    active: number;
    total: number;
  };
  system: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly requestResponseTimes: number[] = [];
  private readonly requestCount = 0;
  private readonly errorCount = 0;
  private startTime: number;
  private prisma: PrismaClient;

  // Request tracking for response time calculation
  private requestTimes = new Map<string, number>();

  constructor(
    private readonly redisService: RedisService,
    @InjectQueue('glm-requests') private readonly glmQueue: Queue,
    @InjectQueue('deal-verification') private readonly verificationQueue: Queue,
    @InjectQueue('analytics') private readonly analyticsQueue: Queue,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {
    this.prisma = new PrismaClient();
    this.startTime = Date.now();
    this.cleanupOldMetrics();
  }

  /**
   * Record request start time
   */
  recordRequestStart(requestId: string): void {
    this.requestTimes.set(requestId, Date.now());
  }

  /**
   * Record request completion and calculate response time
   */
  recordRequestEnd(requestId: string): void {
    const startTime = this.requestTimes.get(requestId);
    if (startTime) {
      const responseTime = Date.now() - startTime;
      this.requestResponseTimes.push(responseTime);
      this.requestTimes.delete(requestId);

      // Keep only last 1000 measurements
      if (this.requestResponseTimes.length > 1000) {
        this.requestResponseTimes.shift();
      }
    }
  }

  /**
   * Get all application metrics
   */
  async getAllMetrics(): Promise<Metrics> {
    const [
      queueMetrics,
      agentMetrics,
      dealMetrics,
      roomMetrics,
      apiMetrics,
      systemMetrics,
    ] = await Promise.all([
      this.getQueueMetrics(),
      this.getAgentMetrics(),
      this.getDealMetrics(),
      this.getRoomMetrics(),
      this.getApiMetrics(),
      this.getSystemMetrics(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      api: apiMetrics,
      queues: queueMetrics,
      agents: agentMetrics,
      deals: dealMetrics,
      rooms: roomMetrics,
      system: systemMetrics,
    };
  }

  /**
   * Get API metrics (response times, request count, error rate)
   */
  private async getApiMetrics(): Promise<{
    responseTimes: { p50: number; p95: number; p99: number; avg: number };
    requestCount: number;
    errorRate: number;
  }> {
    const sortedTimes = [...this.requestResponseTimes].sort((a, b) => a - b);
    const len = sortedTimes.length;

    if (len === 0) {
      return {
        responseTimes: { p50: 0, p95: 0, p99: 0, avg: 0 },
        requestCount: 0,
        errorRate: 0,
      };
    }

    const p50 = sortedTimes[Math.floor(len * 0.5)];
    const p95 = sortedTimes[Math.floor(len * 0.95)];
    const p99 = sortedTimes[Math.floor(len * 0.99)];
    const avg = sortedTimes.reduce((a, b) => a + b, 0) / len;

    return {
      responseTimes: { p50, p95, p99, avg: Math.round(avg) },
      requestCount: len,
      errorRate: 0, // Track errors separately
    };
  }

  /**
   * Get queue metrics
   */
  private async getQueueMetrics(): Promise<
    {
      name: string;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    }[]
  > {
    const queues = [
      { queue: this.glmQueue, name: 'glm_requests' },
      { queue: this.verificationQueue, name: 'deal_verification' },
      { queue: this.analyticsQueue, name: 'analytics' },
      { queue: this.cleanupQueue, name: 'cleanup' },
      { queue: this.notificationsQueue, name: 'notifications' },
    ];

    const results = await Promise.allSettled(
      queues.map(async ({ queue, name }) => {
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
        return {
          name,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
        };
      }),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        name: queues[index].name.replace(/-/g, '_'),
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };
    });
  }

  /**
   * Get agent metrics
   */
  private async getAgentMetrics(): Promise<{
    active: number;
    total: number;
    byStatus: Record<string, number>;
  }> {
    const agents = await this.prisma.agent.findMany({
      select: { status: true },
    });

    const byStatus: Record<string, number> = {};
    let active = 0;

    for (const agent of agents) {
      const status = agent.status;
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (status === 'active' || status === 'negotiating') {
        active++;
      }
    }

    return {
      active,
      total: agents.length,
      byStatus,
    };
  }

  /**
   * Get deal metrics
   */
  private async getDealMetrics(): Promise<{
    total: number;
    completed: number;
    failed: number;
    completionRate: number;
    avgNegotiationTime: number;
  }> {
    const deals = await this.prisma.deal.findMany({
      select: {
        status: true,
        createdAt: true,
        completedAt: true,
        lockedAt: true,
      },
    });

    const total = deals.length;
    const completed = deals.filter((d) => d.status === 'completed').length;
    const failed = deals.filter((d) => d.status === 'failed').length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    // Calculate average negotiation time (from locked to completed)
    const completedDeals = deals.filter(
      (d) => d.status === 'completed' && d.lockedAt && d.completedAt,
    );
    const avgNegotiationTime =
      completedDeals.length > 0
        ? completedDeals.reduce((sum, d) => {
            const lockedTime = new Date(d.lockedAt).getTime();
            const completedTime = new Date(d.completedAt).getTime();
            return sum + (completedTime - lockedTime);
          }, 0) / completedDeals.length / 1000 // Convert to seconds
        : 0;

    return {
      total,
      completed,
      failed,
      completionRate: Math.round(completionRate * 100) / 100,
      avgNegotiationTime: Math.round(avgNegotiationTime),
    };
  }

  /**
   * Get room metrics
   */
  private async getRoomMetrics(): Promise<{ active: number; total: number }> {
    const rooms = await this.prisma.room.findMany({
      select: { status: true },
    });

    const active = rooms.filter((r) => r.status === 'active').length;

    return {
      active,
      total: rooms.length,
    };
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<{
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  }> {
    const memory = process.memoryUsage();
    const totalMemory = memory.heapTotal;
    const usedMemory = memory.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    return {
      uptime: Date.now() - this.startTime,
      memory: {
        used: Math.round(usedMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage * 100) / 100,
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
      },
    };
  }

  /**
   * Format metrics as Prometheus text format
   */
  formatAsPrometheus(metrics: Metrics): string {
    const lines: string[] = [];
    const timestamp = Math.floor(new Date(metrics.timestamp).getTime() / 1000);

    // API metrics
    lines.push(`# API metrics`);
    lines.push(
      `api_response_time_p50{quantile="0.5"} ${metrics.api.responseTimes.p50} ${timestamp}`,
    );
    lines.push(
      `api_response_time_p95{quantile="0.95"} ${metrics.api.responseTimes.p95} ${timestamp}`,
    );
    lines.push(
      `api_response_time_p99{quantile="0.99"} ${metrics.api.responseTimes.p99} ${timestamp}`,
    );
    lines.push(
      `api_response_time_avg ${metrics.api.responseTimes.avg} ${timestamp}`,
    );
    lines.push(`api_request_count ${metrics.api.requestCount} ${timestamp}`);
    lines.push(`api_error_rate ${metrics.api.errorRate} ${timestamp}`);

    // Queue metrics
    lines.push(`\n# Queue metrics`);
    for (const queue of metrics.queues) {
      lines.push(`queue_waiting{name="${queue.name}"} ${queue.waiting} ${timestamp}`);
      lines.push(`queue_active{name="${queue.name}"} ${queue.active} ${timestamp}`);
      lines.push(`queue_completed{name="${queue.name}"} ${queue.completed} ${timestamp}`);
      lines.push(`queue_failed{name="${queue.name}"} ${queue.failed} ${timestamp}`);
    }

    // Agent metrics
    lines.push(`\n# Agent metrics`);
    lines.push(`agents_active ${metrics.agents.active} ${timestamp}`);
    lines.push(`agents_total ${metrics.agents.total} ${timestamp}`);
    for (const [status, count] of Object.entries(metrics.agents.byStatus)) {
      lines.push(`agents_by_status{status="${status}"} ${count} ${timestamp}`);
    }

    // Deal metrics
    lines.push(`\n# Deal metrics`);
    lines.push(`deals_total ${metrics.deals.total} ${timestamp}`);
    lines.push(`deals_completed ${metrics.deals.completed} ${timestamp}`);
    lines.push(`deals_failed ${metrics.deals.failed} ${timestamp}`);
    lines.push(`deals_completion_rate ${metrics.deals.completionRate} ${timestamp}`);
    lines.push(`deals_avg_negotiation_time ${metrics.deals.avgNegotiationTime} ${timestamp}`);

    // Room metrics
    lines.push(`\n# Room metrics`);
    lines.push(`rooms_active ${metrics.rooms.active} ${timestamp}`);
    lines.push(`rooms_total ${metrics.rooms.total} ${timestamp}`);

    // System metrics
    lines.push(`\n# System metrics`);
    lines.push(`system_uptime_ms ${metrics.system.uptime} ${timestamp}`);
    lines.push(`system_memory_used_mb ${metrics.system.memory.used} ${timestamp}`);
    lines.push(`system_memory_total_mb ${metrics.system.memory.total} ${timestamp}`);
    lines.push(`system_memory_percentage ${metrics.system.memory.percentage} ${timestamp}`);
    lines.push(`system_cpu_usage_seconds ${metrics.system.cpu.usage} ${timestamp}`);

    return lines.join('\n');
  }

  /**
   * Cleanup old metrics periodically
   */
  private cleanupOldMetrics(): void {
    // Keep response time data limited to last 1000
    if (this.requestResponseTimes.length > 1000) {
      this.requestResponseTimes.splice(0, this.requestResponseTimes.length - 1000);
    }

    // Cleanup stale request tracking
    setInterval(() => {
      const now = Date.now();
      const staleTimeout = 60000; // 1 minute

      for (const [requestId, startTime] of this.requestTimes.entries()) {
        if (now - startTime > staleTimeout) {
          this.requestTimes.delete(requestId);
        }
      }
    }, 60000); // Check every minute
  }
}
