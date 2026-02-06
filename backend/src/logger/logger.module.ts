import { Module, Global } from '@nestjs/common';
import { AppLoggerService } from './logger.service';

/**
 * Global logging module that provides structured logging throughout the application
 * Uses Winston with daily log rotation and request ID tracking
 */
@Global()
@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class LoggerModule {}
