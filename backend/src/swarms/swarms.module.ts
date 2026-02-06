import { Module } from '@nestjs/common';
import { SwarmsController } from './swarms.controller';
import { SwarmsService } from './swarms.service';
import { AgentsModule } from '../agents/agents.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [AgentsModule, WebsocketModule, RedisModule],
  controllers: [SwarmsController],
  providers: [SwarmsService],
  exports: [SwarmsService],
})
export class SwarmsModule {}
