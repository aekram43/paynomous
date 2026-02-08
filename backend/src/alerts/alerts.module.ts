import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { HealthModule } from '../health/health.module';
import { MetricsModule } from '../metrics/metrics.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HealthModule,
    MetricsModule,
    LoggerModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
