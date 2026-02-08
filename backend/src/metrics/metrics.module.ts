import { Module, Global } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { RedisModule } from '../redis/redis.module';
import { QueuesModule } from '../queues/queues.module';

@Global()
@Module({
  imports: [RedisModule, QueuesModule],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
