import { applyDecorators, UseInterceptors, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';

export interface RateLimitMeta {
  limit: number;
  windowSeconds: number;
  keyPrefix: string;
}

export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Rate limit decorator for use on controller methods
 * Usage: @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'agent-spawn' })
 */
export const RateLimit = (options: RateLimitMeta) => {
  return applyDecorators(
    UseInterceptors(new RateLimitInterceptor(options)),
  );
};

export class RateLimitInterceptor implements NestInterceptor {
  private static reflector = new Reflector();
  private static redisService: RedisService;

  constructor(private options: RateLimitMeta) {}

  static setRedisService(redisService: RedisService) {
    RateLimitInterceptor.redisService = redisService;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!RateLimitInterceptor.redisService) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return new Observable((subscriber) => {
      this.checkRateLimit(request, response)
        .then(() => {
          return next.handle();
        })
        .then((data) => {
          subscriber.next(data);
          subscriber.complete();
        })
        .catch((error) => {
          subscriber.error(error);
        });
    });
  }

  private async checkRateLimit(request: any, response: any): Promise<void> {
    const key = this.getKey(request);

    // Increment the counter
    const currentCount = await RateLimitInterceptor.redisService.incrementRateLimit(
      key,
      this.options.windowSeconds,
    );

    const remaining = Math.max(0, this.options.limit - currentCount);

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', this.options.limit.toString());
    response.setHeader('X-RateLimit-Remaining', remaining.toString());
    response.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(Date.now() / 1000 + this.options.windowSeconds).toString(),
    );

    if (currentCount > this.options.limit) {
      response.setHeader('Retry-After', this.options.windowSeconds.toString());
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
  }

  private getKey(request: any): string {
    // Get identifier from IP or user ID
    let identifier: string;

    if (request.user?.userId) {
      identifier = `user:${request.user.userId}`;
    } else {
      const ip = this.getClientIp(request);
      identifier = `ip:${ip}`;
    }

    return `${this.options.keyPrefix}:${identifier}`;
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }
}

/**
 * Convenience decorator for agent spawn rate limiting (5 per hour per user)
 */
export const AgentSpawnRateLimit = () =>
  RateLimit({
    limit: parseInt(process.env.AGENT_SPAWN_RATE_LIMIT || '5'),
    windowSeconds: parseInt(process.env.AGENT_SPAWN_RATE_WINDOW || '3600'), // 1 hour
    keyPrefix: 'agent-spawn',
  });

/**
 * Convenience decorator for agent message rate limiting (10 per minute per agent)
 */
export const AgentMessageRateLimit = () =>
  RateLimit({
    limit: parseInt(process.env.AGENT_MESSAGE_RATE_LIMIT || '10'),
    windowSeconds: parseInt(process.env.AGENT_MESSAGE_RATE_WINDOW || '60'), // 1 minute
    keyPrefix: 'agent-message',
  });

/**
 * Convenience decorator for global API rate limiting (100 per minute per IP)
 */
export const GlobalRateLimit = () =>
  RateLimit({
    limit: parseInt(process.env.GLOBAL_RATE_LIMIT || '100'),
    windowSeconds: parseInt(process.env.GLOBAL_RATE_WINDOW || '60'), // 1 minute
    keyPrefix: 'global',
  });
