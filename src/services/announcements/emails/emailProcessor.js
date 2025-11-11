const mongoose = require('mongoose');
const EmailService = require('./emailService');
const EmailBatchService = require('./emailBatchService');
const emailSendingService = require('./emailSendingService');
const { EMAIL_CONFIG } = require('../../../config/emailConfig');
const logger = require('../../../startup/logger');

class EmailProcessor {
  /**
   * Initialize processor runtime configuration.
   * - Tracks currently processing parent Email IDs to avoid duplicate work.
   * - Loads retry settings from EMAIL_CONFIG to coordinate with sending service.
   */
  constructor() {
    this.processingBatches = new Set();
    this.maxRetries = EMAIL_CONFIG.DEFAULT_MAX_RETRIES;
    this.retryDelay = EMAIL_CONFIG.INITIAL_RETRY_DELAY_MS;
  }

  /**
   * Process a single parent Email by sending all of its pending EmailBatch items.
   * - Each request is independent - processes only the email passed to it
   * - Idempotent with respect to concurrent calls (skips if already processing)
   * - Simple flow: PENDING → SENDING → SENT/FAILED/PROCESSED
   * @param {string|ObjectId} emailId - The ObjectId of the parent Email.
   * @returns {Promise<string>} Final email status: SENT | FAILED | PROCESSED | SENDING
   * @throws {Error} When emailId is invalid or the Email is not found.
   */
  async processEmail(emailId) {
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      throw new Error('emailId is required and must be a valid ObjectId');
    }

    // Prevent concurrent processing of the same email
    if (this.processingBatches.has(emailId)) {
      logger.logInfo(`Email ${emailId} is already being processed, skipping`);
      return EMAIL_CONFIG.EMAIL_STATUSES.SENDING;
    }

    this.processingBatches.add(emailId);

    try {
      // Get email - don't throw if not found, handle gracefully in processor
      const email = await EmailService.getEmailById(emailId);
      if (!email) {
        throw new Error(`Email not found with id: ${emailId}`);
      }

      // Skip if already in final state
      if (
        email.status === EMAIL_CONFIG.EMAIL_STATUSES.SENT ||
        email.status === EMAIL_CONFIG.EMAIL_STATUSES.FAILED ||
        email.status === EMAIL_CONFIG.EMAIL_STATUSES.PROCESSED
      ) {
        logger.logInfo(`Email ${emailId} is already in final state: ${email.status}`);
        return email.status;
      }

      // Mark email as SENDING (atomic update from PENDING to SENDING)
      // If already SENDING, this will fail and we'll skip processing
      try {
        await EmailService.markEmailStarted(emailId);
      } catch (startError) {
        // If marking as started fails, email is likely already being processed
        const currentEmail = await EmailService.getEmailById(emailId);
        if (currentEmail && currentEmail.status === EMAIL_CONFIG.EMAIL_STATUSES.SENDING) {
          logger.logInfo(`Email ${emailId} is already being processed, skipping`);
          this.processingBatches.delete(emailId);
          return EMAIL_CONFIG.EMAIL_STATUSES.SENDING;
        }
        // Re-throw if it's a different error
        throw startError;
      }

      // Process all PENDING EmailBatch items for this email
      await this.processEmailBatches(email);

      // Determine final status based on batch items
      const finalStatus = await EmailProcessor.determineEmailStatus(email._id);
      await EmailService.markEmailCompleted(emailId, finalStatus);

      logger.logInfo(`Email ${emailId} processed with status: ${finalStatus}`);
      return finalStatus;
    } catch (error) {
      logger.logException(error, `Error processing Email ${emailId}`);

      // Mark email as failed on error
      try {
        await EmailService.markEmailCompleted(emailId, EMAIL_CONFIG.EMAIL_STATUSES.FAILED);
      } catch (updateError) {
        logger.logException(updateError, 'Error updating Email status to failed');
      }
      return EMAIL_CONFIG.EMAIL_STATUSES.FAILED;
    } finally {
      this.processingBatches.delete(emailId);
    }
  }

  /**
   * Process all PENDING EmailBatch items for a given parent Email.
   * - Only processes PENDING batches (simple and straightforward)
   * - Sends batches with limited concurrency
   * - Each request is independent - processes only batches for this email
   * @param {Object} email - The parent Email mongoose document.
   * @returns {Promise<void>}
   */
  async processEmailBatches(email) {
    // Get only PENDING batches for this email (service validates emailId)
    const pendingBatches = await EmailBatchService.getPendingBatchesForEmail(email._id);

    if (pendingBatches.length === 0) {
      logger.logInfo(`No PENDING EmailBatch items found for Email ${email._id}`);
      return;
    }

    logger.logInfo(
      `Processing ${pendingBatches.length} PENDING EmailBatch items for Email ${email._id}`,
    );

    // Process items with concurrency limit
    const concurrency = EMAIL_CONFIG.ANNOUNCEMENTS.CONCURRENCY || 3;
    const results = [];

    // Process batches in chunks with concurrency control
    // eslint-disable-next-line no-await-in-loop
    for (let i = 0; i < pendingBatches.length; i += concurrency) {
      const batch = pendingBatches.slice(i, i + concurrency);
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.allSettled(
        batch.map((item) => this.processEmailBatch(item, email)),
      );
      results.push(...batchResults);
    }

    // Log summary of processing
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.logInfo(
      `Completed processing ${pendingBatches.length} EmailBatch items for Email ${email._id}: ${succeeded} succeeded, ${failed} failed`,
    );
  }

  /**
   * Send one EmailBatch item (one SMTP send for a group of recipients).
   * - Marks batch as SENDING (atomic update from PENDING)
   * - Sends email with retry logic
   * - Marks as SENT on success or FAILED on failure
   * @param {Object} item - The EmailBatch mongoose document (should be PENDING).
   * @param {Object} email - The parent Email mongoose document.
   * @returns {Promise<void>}
   * @throws {Error} Bubbles final failure so callers can classify in allSettled results.
   */
  async processEmailBatch(item, email) {
    if (!item || !item._id) {
      throw new Error('Invalid EmailBatch item');
    }
    if (!email || !email._id) {
      throw new Error('Invalid Email parent');
    }

    const recipientEmails = (item.recipients || [])
      .map((r) => r?.email)
      .filter((e) => e && typeof e === 'string');

    if (recipientEmails.length === 0) {
      logger.logException(
        new Error('No valid recipients found'),
        `EmailBatch item ${item._id} has no valid recipients`,
      );
      await EmailBatchService.markEmailBatchFailed(item._id, {
        errorCode: 'NO_RECIPIENTS',
        errorMessage: 'No valid recipients found',
      });
      return;
    }

    // Mark as SENDING (atomic update from PENDING to SENDING)
    // If this fails, batch was already processed by another thread - skip it
    let updatedItem;
    try {
      updatedItem = await EmailBatchService.markEmailBatchSending(item._id);
    } catch (markError) {
      // Batch was likely already processed - check status and skip if so
      // Use service method for consistency (service validates batchId)
      try {
        const currentBatch = await EmailBatchService.getBatchById(item._id);
        if (currentBatch) {
          if (
            currentBatch.status === EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT ||
            currentBatch.status === EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENDING
          ) {
            logger.logInfo(
              `EmailBatch ${item._id} is already ${currentBatch.status}, skipping duplicate processing`,
            );
            return; // Skip this batch
          }
        }
      } catch (batchError) {
        // If batch not found or invalid ID, log and re-throw original error
        logger.logException(batchError, `Error checking EmailBatch ${item._id} status`);
      }
      // Re-throw if it's a different error
      throw markError;
    }

    // Build mail options
    const mailOptions = {
      from: EMAIL_CONFIG.EMAIL.SENDER,
      subject: email.subject,
      html: email.htmlContent,
    };

    if (item.emailType === EMAIL_CONFIG.EMAIL_TYPES.BCC) {
      mailOptions.to = EMAIL_CONFIG.EMAIL.SENDER;
      mailOptions.bcc = recipientEmails.join(',');
    } else {
      mailOptions.to = recipientEmails.join(',');
    }

    // Delegate retry/backoff to the sending service
    const sendResult = await emailSendingService.sendWithRetry(
      mailOptions,
      this.maxRetries,
      this.retryDelay,
    );

    if (sendResult.success) {
      const actualAttemptCount = sendResult.attemptCount || updatedItem?.attempts || 1;
      await EmailBatchService.markEmailBatchSent(item._id, {
        attemptCount: actualAttemptCount, // Persist the actual number of attempts made
      });
      logger.logInfo(
        `EmailBatch item ${item._id} sent successfully to ${recipientEmails.length} recipients (attempts ${actualAttemptCount})`,
      );
      return;
    }

    // Final failure after retries
    const finalError = sendResult.error || new Error('Failed to send email');
    // Extract error code, or use error name if code is missing, or default to 'SEND_FAILED'
    const errorCode = finalError.code || finalError.name || 'SEND_FAILED';
    const errorMessage = finalError.message || 'Failed to send email';
    const actualAttemptCount = sendResult.attemptCount || 1; // Use actual attempt count from retry logic

    await EmailBatchService.markEmailBatchFailed(item._id, {
      errorCode,
      errorMessage,
      attemptCount: actualAttemptCount, // Persist the actual number of attempts made
    });

    logger.logInfo(
      `Permanently failed to send EmailBatch item ${item._id} to ${recipientEmails.length} recipients after ${actualAttemptCount} attempts`,
    );
    // Throw to ensure Promise.allSettled records this item as failed
    throw finalError;
  }

  /**
   * Sleep utility to await a given duration.
   * @param {number} ms - Milliseconds to wait.
   * @returns {Promise<void>}
   */
  static sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Determine the final parent Email status from child EmailBatch statuses.
   * Rules:
   * - All SENT => SENT
   * - All FAILED => FAILED
   * - Mixed (some SENT and some FAILED) => PROCESSED
   * - Otherwise (PENDING or SENDING batches) => SENDING (still in progress)
   * @param {ObjectId} emailObjectId - Parent Email ObjectId.
   * @returns {Promise<string>} Derived status constant from EMAIL_CONFIG.EMAIL_STATUSES.
   */
  static async determineEmailStatus(emailObjectId) {
    // Get all batches and count statuses in memory (simpler and faster for small-medium counts)
    // Use service method for consistency (service validates emailId)
    const batches = await EmailBatchService.getBatchesForEmail(emailObjectId);

    const statusMap = batches.reduce((acc, batch) => {
      acc[batch.status] = (acc[batch.status] || 0) + 1;
      return acc;
    }, {});

    const pending = statusMap[EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING] || 0;
    const sending = statusMap[EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENDING] || 0;
    const sent = statusMap[EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT] || 0;
    const failed = statusMap[EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED] || 0;

    // All sent = SENT
    if (sent > 0 && pending === 0 && sending === 0 && failed === 0) {
      return EMAIL_CONFIG.EMAIL_STATUSES.SENT;
    }

    // All failed = FAILED
    if (failed > 0 && pending === 0 && sending === 0 && sent === 0) {
      return EMAIL_CONFIG.EMAIL_STATUSES.FAILED;
    }

    // Mixed results (some sent, some failed) = PROCESSED
    if (sent > 0 || failed > 0) {
      return EMAIL_CONFIG.EMAIL_STATUSES.PROCESSED;
    }

    // Still processing (pending or sending batches) = keep SENDING status
    return EMAIL_CONFIG.EMAIL_STATUSES.SENDING;
  }

  /**
   * Get lightweight processor status for diagnostics/telemetry.
   * @returns {{isRunning: boolean, processingBatches: string[], maxRetries: number}}
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
const emailProcessor = new EmailProcessor();

module.exports = emailProcessor;
