/**
 * Enhanced Email Batch Processor - Production Ready with Audit Integration
 * Focus: Efficient processing with email body from batch record and comprehensive auditing
 */

const Email = require('../models/email');
const EmailBatch = require('../models/emailBatch');
const emailAnnouncementService = require('./emailAnnouncementService');
const EmailBatchAuditService = require('./emailBatchAuditService');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');
const logger = require('../startup/logger');

class EmailBatchProcessor {
  constructor() {
    this.processingBatches = new Set();
    this.maxRetries = EMAIL_JOB_CONFIG.DEFAULT_MAX_RETRIES;
    this.retryDelay = 2000; // 2 seconds
  }

  /**
   * Process a batch
   */
  async processBatch(batchId) {
    if (this.processingBatches.has(batchId)) {
      return; // Already processing
    }

    this.processingBatches.add(batchId);

    try {
      console.log('🔍 Looking for batch with batchId:', batchId);
      const batch = await Email.findOne({ batchId });
      if (!batch) {
        console.error('❌ Batch not found with batchId:', batchId);
        throw new Error('Batch not found');
      }
      console.log('✅ Found batch:', batch.batchId, 'Status:', batch.status);

      if (
        batch.status === EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENT ||
        batch.status === EMAIL_JOB_CONFIG.EMAIL_STATUSES.FAILED
      ) {
        return;
      }

      // Update batch status
      batch.status = EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENDING;
      batch.startedAt = new Date();
      await batch.save();

      // Process batch items (each item contains multiple recipients)
      await this.processBatchItems(batch);

      // Update final status
      await batch.updateStatus();
      logger.logInfo(`Batch ${batchId} processed successfully`);
    } catch (error) {
      logger.logException(error, `Error processing batch ${batchId}`);

      // Mark batch as failed
      try {
        const batch = await Email.findOne({ batchId });
        if (batch) {
          batch.status = EMAIL_JOB_CONFIG.EMAIL_STATUSES.FAILED;
          batch.completedAt = new Date();
          await batch.save();
        }
      } catch (updateError) {
        logger.logException(updateError, 'Error updating batch status to failed');
      }
    } finally {
      this.processingBatches.delete(batchId);
    }
  }

  /**
   * Process all items in a batch
   */
  async processBatchItems(batch) {
    const items = await EmailBatch.find({
      batchId: batch._id,
      status: EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.QUEUED,
    });

    // Process items in parallel with concurrency limit
    const processPromises = items.map((item) => this.processItem(item, batch));
    await Promise.all(processPromises);
  }

  /**
   * Process a single batch item with multiple recipients
   */
  async processItem(item, batch) {
    const processWithRetry = async (attempt = 1) => {
      try {
        // Update to SENDING status (this increments attempts)
        await item.updateStatus(EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENDING);

        // Extract recipient emails from the batch item
        const recipientEmails = item.recipients.map((recipient) => recipient.email);

        // Use the new emailAnnouncementService with enhanced announcement features
        const gmailResponse = await emailAnnouncementService.sendAnnouncement(
          recipientEmails, // Array of emails for batching
          batch.subject,
          batch.htmlContent, // Use email body from batch record
          null, // attachments
          null, // cc
          null, // replyTo
          null, // bcc
          {
            announcementType: 'batch_send',
            batchId: batch.batchId,
            itemId: item._id,
            emailType: item.emailType,
            recipientCount: recipientEmails.length,
            priority: 'NORMAL',
          },
        );

        // Mark as sent
        await item.updateStatus(EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENT);

        // Log successful send to audit
        await EmailBatchAuditService.logEmailBatchSent(
          batch._id,
          item._id,
          {
            recipientCount: recipientEmails.length,
            emailType: item.emailType,
            attempt: item.attempts,
          },
          gmailResponse,
        );

        logger.logInfo(
          `Email batch sent successfully to ${recipientEmails.length} recipients (attempt ${item.attempts})`,
        );
        // Success
      } catch (error) {
        logger.logException(
          error,
          `Failed to send email batch to ${item.recipients.length} recipients (attempt ${attempt})`,
        );

        if (attempt >= this.maxRetries) {
          await item.updateStatus(
            EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.FAILED,
            error.message,
            error.code,
          );

          // Log failed send to audit
          await EmailBatchAuditService.logEmailBatchFailed(batch._id, item._id, error, {
            recipientCount: item.recipients.length,
            emailType: item.emailType,
            finalAttempt: attempt,
          });

          logger.logError(
            `Permanently failed to send email batch to ${item.recipients.length} recipients after ${this.maxRetries} attempts`,
          );
          return;
        }

        // Wait before retry
        await EmailBatchProcessor.sleep(this.retryDelay);
        return processWithRetry(attempt + 1);
      }
    };

    return processWithRetry();
  }

  /**
   * Sleep utility
   */
  static sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Retry a specific batch item
   */
  async retryBatchItem(itemId) {
    try {
      const item = await EmailBatch.findById(itemId);
      if (!item) {
        throw new Error('Batch item not found');
      }

      const batch = await Email.findById(item.batchId);
      if (!batch) {
        throw new Error('Parent batch not found');
      }

      // Process the specific item
      await this.processItem(item, batch);

      return {
        success: true,
        itemId: item._id,
        status: item.status,
      };
    } catch (error) {
      logger.logException(error, 'Error retrying batch item');
      throw error;
    }
  }

  /**
   * Get processor status
   */
  getStatus() {
    return {
      isRunning: true,
      processingBatches: Array.from(this.processingBatches),
      maxRetries: this.maxRetries,
    };
  }
}

// Create singleton instance
const emailBatchProcessor = new EmailBatchProcessor();

module.exports = emailBatchProcessor;
