import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentDecisionService } from './agent-decision.service';
import { GlmModule } from '../glm/glm.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'glm-requests',
    }),
    GlmModule,
    forwardRef(() => WebsocketModule),
  ],
  controllers: [AgentsController],
  providers: [AgentsService, AgentDecisionService],
  exports: [AgentsService, AgentDecisionService],
})
export class AgentsModule {}
