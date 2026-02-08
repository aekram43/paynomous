import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RedisModule } from '../redis/redis.module';
import { RustModule } from '../rust/rust.module';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [RedisModule, RustModule, QueuesModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
