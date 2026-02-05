import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { GlmService, Agent, RoomContext } from '../../glm/glm.service';

export interface GlmRequestJob {
  type: 'generate_agent_response';
  agent: Agent;
  roomContext: RoomContext;
  triggerMessage: string;
}

@Processor('glm-requests', {
  concurrency: 5,
})
export class GlmProcessor extends WorkerHost {
  private readonly logger = new Logger(GlmProcessor.name);

  constructor(private readonly glmService: GlmService) {
    super();
  }

  async process(job: Job<GlmRequestJob>): Promise<any> {
    this.logger.log(`Processing GLM request for agent ${job.data.agent.id}`);

    try {
      const response = await this.glmService.generateAgentResponse(
        job.data.agent,
        job.data.roomContext,
        job.data.triggerMessage,
      );

      this.logger.log(`GLM request completed for agent ${job.data.agent.id}`);
      return {
        success: true,
        agentId: job.data.agent.id,
        response,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process GLM request for agent ${job.data.agent.id}`,
        error.stack,
      );
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<GlmRequestJob>, result: any) {
    this.logger.debug(
      `GLM job ${job.id} completed for agent ${job.data.agent.id}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<GlmRequestJob>, error: Error) {
    this.logger.error(
      `GLM job ${job.id} failed for agent ${job.data.agent.id}: ${error.message}`,
    );
  }
}
