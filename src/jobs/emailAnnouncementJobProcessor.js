/**
 * Email Announcement Job Processor
 * Cron-based processor for email announcement job queue
 */

const { CronJob } = require('cron');
const Email = require('../models/email');
const emailBatchProcessor = require('../services/emailBatchProcessor');
const EmailBatchAuditService = require('../services/emailBatchAuditService');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');
const logger = require('../startup/logger');

class EmailAnnouncementJobProcessor {
  constructor() {
    this.isProcessing = false;
    this.maxConcurrentBatches = EMAIL_JOB_CONFIG.MAX_CONCURRENT_BATCHES;
    this.processingInterval = EMAIL_JOB_CONFIG.CRON_INTERVAL;
    this.cronJob = null;
  }

  /**
   * Start the job processor
   */
  start() {
    if (this.cronJob) {
      logger.logInfo('Email announcement job processor is already running');
      return;
    }

    this.cronJob = new CronJob(
      EMAIL_JOB_CONFIG.CRON_INTERVAL,
      async () => {
        await this.processPendingBatches();
      },
      null,
      false, // Don't start immediately
      'America/Los_Angeles',
    );

    this.cronJob.start();
    logger.logInfo(`Email announcement job processor started - runs every minute`);
  }

  /**
   * Stop the job processor
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.logInfo('Email announcement job processor stopped');
    }
  }

  /**
   * Process pending batches
   */
  async processPendingBatches() {
    if (this.isProcessing) {
      logger.logInfo('Email job processor is already running, skipping this cycle');
      return;
    }

    this.isProcessing = true;

    try {
      // Get batches ready for processing
      const pendingBatches = await Email.find({
        status: EMAIL_JOB_CONFIG.EMAIL_STATUSES.QUEUED,
      })
        .sort({ createdAt: 1 }) // FIFO order
        .limit(this.maxConcurrentBatches);

      if (pendingBatches.length === 0) {
        logger.logInfo('No pending email batches to process');
        return;
      }

      logger.logInfo(`Processing ${pendingBatches.length} email batches`);

      // Process each batch
      const processingPromises = pendingBatches.map((batch) =>
        EmailAnnouncementJobProcessor.processBatchWithAuditing(batch),
      );

      await Promise.allSettled(processingPromises);
    } catch (error) {
      logger.logException(error, 'Error processing announcement batches');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single batch with comprehensive auditing
   */
  static async processBatchWithAuditing(batch) {
    const startTime = Date.now();

    try {
      // Log batch start
      await EmailBatchAuditService.logEmailStarted(batch._id, {
        batchId: batch.batchId,
        subject: batch.subject,
        recipientCount: await batch.getEmailCounts(),
      });

      // Update batch status
      batch.status = EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENDING;
      batch.startedAt = new Date();
      await batch.save();

      // Process using existing emailBatchProcessor
      await emailBatchProcessor.processBatch(batch.batchId);

      const processingTime = Date.now() - startTime;

      // Log completion
      await EmailBatchAuditService.logEmailCompleted(batch._id, {
        batchId: batch.batchId,
        processingTime,
        finalCounts: await batch.getEmailCounts(),
      });

      logger.logInfo(`Successfully processed batch ${batch.batchId} in ${processingTime}ms`);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Log error
      await EmailBatchAuditService.logEmailFailed(batch._id, error, {
        batchId: batch.batchId,
        processingTime,
        errorMessage: error.message,
      });

      logger.logException(error, `Failed to process batch ${batch.batchId}`);
    }
  }

  /**
   * Get processor status
   */
  getStatus() {
    return {
      isRunning: !!this.cronJob,
      isProcessing: this.isProcessing,
      maxConcurrentBatches: this.maxConcurrentBatches,
      cronInterval: this.processingInterval,
      nextRun: this.cronJob ? this.cronJob.nextDate() : null,
    };
  }

  /**
   * Get pending batches count
   */
  static async getPendingBatchesCount() {
    return Email.countDocuments({
      status: EMAIL_JOB_CONFIG.EMAIL_STATUSES.QUEUED,
    });
  }

  /**
   * Get processing statistics
   */
  static async getProcessingStats() {
    const stats = await Email.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgProcessingTime: {
            $avg: {
              $cond: [
                { $ne: ['$processingStartedAt', null] },
                { $subtract: ['$completedAt', '$processingStartedAt'] },
                null,
              ],
            },
          },
        },
      },
    ]);

    return {
      statusCounts: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      averageProcessingTime: stats[0]?.avgProcessingTime || 0,
      lastUpdated: new Date(),
    };
  }
}

// Create singleton instance
const emailAnnouncementJobProcessor = new EmailAnnouncementJobProcessor();

module.exports = emailAnnouncementJobProcessor;
