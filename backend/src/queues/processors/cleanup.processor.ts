import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

export interface CleanupJob {
  type: 'cleanup_old_messages' | 'archive_completed_deals';
  olderThan: Date;
}

@Processor('cleanup', {
  concurrency: 1,
})
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  async process(job: Job<CleanupJob>): Promise<any> {
    this.logger.log(`Processing cleanup job type: ${job.data.type}`);

    try {
      if (job.data.type === 'cleanup_old_messages') {
        return await this.cleanupOldMessages(job.data.olderThan);
      } else if (job.data.type === 'archive_completed_deals') {
        return await this.archiveCompletedDeals(job.data.olderThan);
      }

      return { success: false, message: 'Unknown cleanup job type' };
    } catch (error) {
      this.logger.error(
        `Failed to process cleanup job: ${job.data.type}`,
        error.stack
      );
      throw error;
    }
  }

  private async cleanupOldMessages(olderThan: Date): Promise<any> {
    this.logger.log(`Cleaning up messages older than ${olderThan}`);

    // TODO: Implement actual message cleanup
    // This will delete or archive old messages from the messages table

    return {
      success: true,
      messagesDeleted: 0,
      olderThan,
    };
  }

  private async archiveCompletedDeals(olderThan: Date): Promise<any> {
    this.logger.log(`Archiving deals completed before ${olderThan}`);

    // TODO: Implement actual deal archival
    // This will move completed deals to an archive table or cold storage

    return {
      success: true,
      dealsArchived: 0,
      olderThan,
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CleanupJob>, result: any) {
    this.logger.debug(
      `Cleanup job ${job.id} completed for type ${job.data.type}`
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CleanupJob>, error: Error) {
    this.logger.error(
      `Cleanup job ${job.id} failed for type ${job.data.type}: ${error.message}`
    );
  }
}
