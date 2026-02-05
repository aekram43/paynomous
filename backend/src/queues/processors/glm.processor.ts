import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

export interface GlmRequestJob {
  type: 'generate_agent_response';
  agentId: string;
  roomContext: {
    floorPrice: number;
    topBid: number;
    recentMessages: any[];
    competitorCount: number;
  };
  prompt: string;
}

@Processor('glm-requests', {
  concurrency: 5,
})
export class GlmProcessor extends WorkerHost {
  private readonly logger = new Logger(GlmProcessor.name);

  async process(job: Job<GlmRequestJob>): Promise<any> {
    this.logger.log(`Processing GLM request for agent ${job.data.agentId}`);

    try {
      // TODO: Implement actual GLM API call in US-008
      // For now, return a mock response
      const response = {
        success: true,
        message: 'GLM response placeholder',
        agentId: job.data.agentId,
      };

      this.logger.log(`GLM request completed for agent ${job.data.agentId}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to process GLM request for agent ${job.data.agentId}`,
        error.stack
      );
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<GlmRequestJob>, result: any) {
    this.logger.debug(
      `GLM job ${job.id} completed for agent ${job.data.agentId}`
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<GlmRequestJob>, error: Error) {
    this.logger.error(
      `GLM job ${job.id} failed for agent ${job.data.agentId}: ${error.message}`
    );
  }
}
