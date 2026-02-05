import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { GlmService, Agent, RoomContext } from '../../glm/glm.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';

export interface GlmRequestJob {
  type: 'generate_agent_response';
  agentId: string;
  agent: Agent;
  roomContext: RoomContext;
  triggerMessage: string;
}

@Processor('glm-requests', {
  concurrency: 5,
})
export class GlmProcessor extends WorkerHost {
  private readonly logger = new Logger(GlmProcessor.name);

  constructor(
    private readonly glmService: GlmService,
    @Inject(forwardRef(() => WebsocketGateway))
    private readonly websocketGateway: WebsocketGateway,
  ) {
    super();
  }

  async process(job: Job<GlmRequestJob>): Promise<any> {
    this.logger.log(`Processing GLM request for agent ${job.data.agent.name}`);

    try {
      const response = await this.glmService.generateAgentResponse(
        job.data.agent,
        job.data.roomContext,
        job.data.triggerMessage,
      );

      // Broadcast agent message to room via WebSocket
      this.websocketGateway.broadcastAgentMessage(job.data.roomContext.roomId, {
        agent: {
          id: job.data.agent.id,
          name: job.data.agent.name,
          avatar: '🤖', // Default avatar, should come from agent data
          role: job.data.agent.role,
        },
        message: response.message,
        priceMentioned: response.priceMentioned,
        intent: response.intent,
        sentiment: response.sentiment,
      });

      this.logger.log(
        `GLM request completed for agent ${job.data.agent.name}: ${response.intent}`,
      );

      return {
        success: true,
        agentId: job.data.agent.id,
        response,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process GLM request for agent ${job.data.agent.name}`,
        error.stack,
      );
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<GlmRequestJob>, result: any) {
    this.logger.debug(
      `GLM job ${job.id} completed for agent ${job.data.agent.name}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<GlmRequestJob>, error: Error) {
    this.logger.error(
      `GLM job ${job.id} failed for agent ${job.data.agent.name}: ${error.message}`,
    );
  }
}
