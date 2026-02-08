import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that:
 * 1. Prevents sensitive data from being exposed in error responses
 * 2. Sanitizes error messages for production
 * 3. Logs errors with appropriate context
 * 4. Returns consistent error response format
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // Handle HTTP exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = this.sanitizeMessage(exceptionResponse);
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, any>;
        message = this.sanitizeMessage(responseObj.message || responseObj.error || message);

        // Handle validation errors
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
        }
      }
    } else if (exception instanceof Error) {
      // Handle non-HTTP exceptions
      message = this.isProduction()
        ? 'Internal server error'
        : this.sanitizeMessage(exception.message);
    }

    // Log error with context (but not sensitive data)
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Message: ${message}`,
      exception instanceof Error && !this.isProduction() ? exception.stack : undefined,
    );

    // Build error response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      // Only include stack trace in non-production environments
      ...(this.isProduction() ? {} : { stack: exception instanceof Error ? exception.stack : undefined }),
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Sanitize message to prevent sensitive data leakage
   */
  private sanitizeMessage(message: any): string {
    if (typeof message !== 'string') {
      return 'An error occurred';
    }

    // List of sensitive patterns to redact
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /api[_-]?key/i,
      /token/i,
      /authorization/i,
      /private[_-]?key/i,
      /wallet[_-]?private/i,
      /seed/i,
    ];

    let sanitized = message;

    // Redact sensitive patterns
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }

  /**
   * Check if running in production environment
   */
  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
