import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extended Request interface with requestId property
 */
export interface RequestWithRequestId extends Request {
  id: string;
  requestId: string;
}

/**
 * Middleware that adds a unique request ID to each incoming request
 * for tracing and debugging purposes
 *
 * Request IDs are generated using UUID v4 and can be:
 * - Generated fresh for each request
 * - Extracted from X-Request-ID header if provided by client/load balancer
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithRequestId, res: Response, next: NextFunction) {
    // Generate or extract request ID
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    // Attach request ID to the request object
    req.id = requestId;
    req.requestId = requestId;

    // Add request ID to response headers for client-side tracing
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
