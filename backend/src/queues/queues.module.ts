import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GlmProcessor } from './processors/glm.processor';
import { DealVerificationProcessor } from './processors/deal-verification.processor';
import { AnalyticsProcessor } from './processors/analytics.processor';
import { CleanupProcessor } from './processors/cleanup.processor';
import { NotificationsProcessor } from './processors/notifications.processor';
import { GlmModule } from '../glm/glm.module';

@Module({
  imports: [
    GlmModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue(
      {
        name: 'glm-requests',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
      {
        name: 'deal-verification',
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
      {
        name: 'analytics',
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      },
      {
        name: 'cleanup',
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      },
      {
        name: 'notifications',
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      }
    ),
  ],
  providers: [
    GlmProcessor,
    DealVerificationProcessor,
    AnalyticsProcessor,
    CleanupProcessor,
    NotificationsProcessor,
  ],
  exports: [BullModule],
})
export class QueuesModule {}
