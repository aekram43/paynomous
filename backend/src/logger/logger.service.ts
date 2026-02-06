import { Injectable, Scope } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Log levels for the application
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

/**
 * Structured log context that includes request tracking information
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  walletAddress?: string;
  agentId?: string;
  dealId?: string;
  roomId?: string;
  [key: string]: any;
}

/**
 * Custom logger service that wraps Winston with structured logging
 * and request ID tracking capabilities
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService {
  private readonly logger: winston.Logger;
  private context?: string;

  constructor(context?: string) {
    this.context = context;
    this.logger = this.createLogger();
  }

  /**
   * Create Winston logger with daily log rotation
   */
  private createLogger(): winston.Logger {
    const logDir = process.env.LOG_DIR || 'logs';
    const isProduction = process.env.NODE_ENV === 'production';
    const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const ctx = context || this.context || 'Application';
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}] [${ctx}] ${message} ${metaStr}`;
      }),
    );

    // Console format for development (colorized)
    const consoleFormat = winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const ctx = context || this.context || 'App';
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${ctx}] ${message} ${metaStr}`;
      }),
    );

    // Daily rotate file transport for all logs
    const allLogsTransport = new DailyRotateFile({
      filename: `${logDir}/application-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    });

    // Daily rotate file transport for errors only
    const errorLogsTransport = new DailyRotateFile({
      filename: `${logDir}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
    });

    // Combine transports based on environment
    const transports: winston.transport[] = [
      allLogsTransport,
      errorLogsTransport,
    ];

    // Add console transport in development
    if (!isProduction) {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
        }),
      );
    }

    return winston.createLogger({
      level: logLevel,
      transports,
      exitOnError: false,
    });
  }

  /**
   * Set the context for this logger instance
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Log a message with context
   */
  log(message: string, context?: LogContext): void {
    this.logger.info(message, { context: context || this.context });
  }

  /**
   * Log an error message with stack trace and context
   */
  error(message: string, trace?: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  error(message: string, traceOrError?: string | Error, context?: LogContext): void {
    const meta: any = { context: context || this.context };

    if (traceOrError) {
      if (typeof traceOrError === 'string') {
        meta.stack = traceOrError;
      } else if (traceOrError instanceof Error) {
        meta.stack = traceOrError.stack;
        meta.errorName = traceOrError.name;
        meta.errorMessage = traceOrError.message;
      }
    }

    this.logger.error(message, meta);
  }

  /**
   * Log a warning message with context
   */
  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { context: context || this.context });
  }

  /**
   * Log a debug message with context
   */
  debug?(message: string, context?: LogContext): void {
    this.logger.debug(message, { context: context || this.context });
  }

  /**
   * Log a verbose message with context
   */
  verbose?(message: string, context?: LogContext): void {
    this.logger.verbose(message, { context: context || this.context });
  }

  /**
   * Log with specific level and structured context
   */
  logWithContext(level: LogLevel, message: string, context: LogContext): void {
    this.logger[level](message, context);
  }

  /**
   * Log an API failure with retry information
   */
  logApiFailure(
    apiName: string,
    endpoint: string,
    error: Error,
    retryAttempt?: number,
    maxRetries?: number,
    context?: LogContext,
  ): void {
    const meta: LogContext = {
      ...context,
      api: apiName,
      endpoint,
      errorName: error.name,
      errorMessage: error.message,
      retryAttempt,
      maxRetries,
    };

    if (retryAttempt !== undefined && maxRetries !== undefined) {
      if (retryAttempt < maxRetries) {
        this.logger.warn(`${apiName} API call failed (will retry): ${endpoint}`, meta);
      } else {
        this.logger.error(`${apiName} API call failed after ${maxRetries} retries: ${endpoint}`, error.stack, meta);
      }
    } else {
      this.logger.error(`${apiName} API call failed: ${endpoint}`, error.stack, meta);
    }
  }

  /**
   * Log a blockchain transaction failure with detailed context
   */
  logBlockchainFailure(
    operation: string,
    transactionType: string,
    error: Error,
    context?: LogContext,
  ): void {
    const meta: LogContext = {
      ...context,
      operation,
      transactionType,
      errorName: error.name,
      errorMessage: error.message,
    };

    this.logger.error(
      `Blockchain ${operation} failed for ${transactionType}: ${error.message}`,
      error.stack,
      meta,
    );
  }

  /**
   * Log a critical error that requires immediate attention
   */
  logCritical(message: string, error?: Error, context?: LogContext): void {
    const meta: LogContext = {
      ...context,
      critical: true,
      timestamp: new Date().toISOString(),
    };

    if (error) {
      meta.errorName = error.name;
      meta.errorMessage = error.message;
      meta.stack = error.stack;
    }

    this.logger.error(`[CRITICAL] ${message}`, meta);
  }
}
