import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../redis/redis.service';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly options: RateLimitOptions;

  constructor(
    private readonly redisService: RedisService,
    options?: RateLimitOptions,
  ) {
    this.options = options || { limit: 100, windowSeconds: 60 };
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const key = this.getKey(req);

    // Increment the counter
    const currentCount = await this.redisService.incrementRateLimit(
      key,
      this.options.windowSeconds,
    );

    const remaining = Math.max(0, this.options.limit - currentCount);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', this.options.limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(Date.now() / 1000 + this.options.windowSeconds).toString(),
    );

    if (currentCount > this.options.limit) {
      res.setHeader('Retry-After', this.options.windowSeconds.toString());
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please try again later.',
          limit: this.options.limit,
          remaining: 0,
          reset: Math.ceil(Date.now() / 1000 + this.options.windowSeconds),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }

  private getKey(req: Request): string {
    const prefix = this.options.keyPrefix || 'global';

    // Get identifier from IP or user ID
    let identifier: string;

    // Check if req.user exists and has userId (from JWT payload)
    if ((req as any).user?.userId) {
      identifier = `user:${(req as any).user.userId}`;
    } else {
      const ip = this.getClientIp(req);
      identifier = `ip:${ip}`;
    }

    return `${prefix}:${identifier}`;
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}
