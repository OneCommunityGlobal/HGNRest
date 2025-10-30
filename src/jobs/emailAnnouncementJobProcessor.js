const { CronJob } = require('cron');
const Email = require('../models/email');
const emailProcessor = require('../services/emailProcessor');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');
const logger = require('../startup/logger');

class EmailAnnouncementJobProcessor {
  constructor() {
    this.isProcessing = false;
    this.batchFetchLimit = EMAIL_JOB_CONFIG.MAX_CONCURRENT_BATCHES;
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
    logger.logInfo('Email announcement job processor started - runs on configured interval');

    this.cronJob = new CronJob(
      EMAIL_JOB_CONFIG.CRON_INTERVAL,
      async () => {
        await this.processPendingBatches();
      },
      null,
      false,
      'UTC',
    );
    logger.logInfo(
      `Email announcement job processor started – cron=${EMAIL_JOB_CONFIG.CRON_INTERVAL}, tz=${EMAIL_JOB_CONFIG.TIMEZONE || 'UTC'}`,
    );
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
   * Processes ALL queued emails regardless of individual failures - ensures maximum delivery
   */
  async processPendingBatches() {
    if (this.isProcessing) {
      logger.logInfo('Email job processor is already running, skipping this cycle');
      return;
    }

    this.isProcessing = true;

    try {
      // Get batches ready for processing (QUEUED and stuck SENDING emails from previous crash/restart)
      // Emails stuck in SENDING for more than 5 minutes are likely orphaned
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const pendingBatches = await Email.find({
        $or: [
          { status: EMAIL_JOB_CONFIG.EMAIL_STATUSES.QUEUED },
          {
            status: EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENDING,
            $or: [
              { startedAt: { $lt: fiveMinutesAgo } },
              { startedAt: { $exists: false } }, // recover ones missing a timestamp
              { startedAt: null },
            ],
          },
        ],
      })
        .sort({ createdAt: 1 }) // FIFO order
        .limit(this.batchFetchLimit);

      if (pendingBatches.length === 0) {
        logger.logInfo('No pending email batches to process');
        return;
      }

      logger.logInfo(`Processing ${pendingBatches.length} email batches`);

      // Check for and log stuck emails
      const stuckEmails = pendingBatches.filter(
        (email) => email.status === EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENDING,
      );
      if (stuckEmails.length > 0) {
        logger.logInfo(
          `Recovering ${stuckEmails.length} emails stuck in SENDING state from previous restart/crash`,
        );
      }

      // Process each email - allSettled to avoid blocking on failures
      const results = await Promise.allSettled(
        pendingBatches.map((email) =>
          EmailAnnouncementJobProcessor.processBatchWithAuditing(email),
        ),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const succeeded = fulfilled.filter((r) => r.value).length;
      const failed = results.length - succeeded;

      logger.logInfo(
        `Completed processing cycle: ${succeeded} email batches succeeded, ${failed} failed out of ${pendingBatches.length} total`,
      );
    } catch (error) {
      logger.logException(error, 'Error in announcement batch processing cycle');
      // Continue processing - don't block other emails
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single Email with comprehensive auditing
   * Never throws - ensures other emails continue processing even if this one fails
   */
  static async processBatchWithAuditing(email) {
    const startTime = Date.now();

    try {
      // Process using existing emailProcessor
      const finalStatus = await emailProcessor.processEmail(email._id);

      const processingTime = Date.now() - startTime;

      // Completion audit is handled in the processor based on final status
      logger.logInfo(
        `Processed Email ${email._id} with status ${finalStatus} in ${processingTime}ms`,
      );

      // Return true for success, false for failure
      const isSuccess =
        finalStatus === EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENT ||
        finalStatus === EMAIL_JOB_CONFIG.EMAIL_STATUSES.PROCESSED;
      return isSuccess;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Failure audit is handled in the processor
      logger.logException(error, `Failed to process Email ${email._id} after ${processingTime}ms`);

      // Return false to indicate failure but don't throw - allows other emails to continue
      return false;
    }
  }

  /**
   * Get processor status
   */
  getStatus() {
    return {
      isRunning: !!this.cronJob,
      isProcessing: this.isProcessing,
      batchFetchLimit: this.batchFetchLimit,
      cronInterval: this.processingInterval,
      nextRun: this.cronJob ? new Date(this.cronJob.nextDate().toString()) : null,
    };
  }

  /**
   * Get worker status (minimal info for frontend display)
   */
  getWorkerStatus() {
    return {
      running: !!this.cronJob,
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
}

// Create singleton instance
const emailAnnouncementJobProcessor = new EmailAnnouncementJobProcessor();

module.exports = emailAnnouncementJobProcessor;
