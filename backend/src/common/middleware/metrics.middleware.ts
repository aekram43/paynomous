import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MetricsService } from '../../metrics/metrics.service';

declare module 'express' {
  export interface Request {
    requestId: string;
    metricsStartTime?: number;
  }
}

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private static metricsService: MetricsService;

  static setMetricsService(service: MetricsService): void {
    this.metricsService = service;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Generate unique request ID
    req.requestId = uuidv4();
    req.metricsStartTime = Date.now();

    // Record request start in metrics service
    if (MetricsMiddleware.metricsService) {
      MetricsMiddleware.metricsService.recordRequestStart(req.requestId);
    }

    // Record response time when response finishes
    res.on('finish', () => {
      if (MetricsMiddleware.metricsService && req.requestId) {
        MetricsMiddleware.metricsService.recordRequestEnd(req.requestId);
      }
    });

    next();
  }
}
