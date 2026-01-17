const mongoose = require('mongoose');
const EmailService = require('./emailService');
const EmailBatchService = require('./emailBatchService');
const emailSendingService = require('./emailSendingService');
const { EMAIL_CONFIG } = require('../../../config/emailConfig');
// const logger = require('../../../startup/logger');

class EmailProcessor {
  /**
   * Initialize processor runtime configuration.
   * - Tracks currently processing parent Email IDs to avoid duplicate work.
   * - Loads retry settings from EMAIL_CONFIG to coordinate with sending service.
   * - Maintains in-memory queue for sequential email processing.
   */
  constructor() {
    this.processingBatches = new Set();
    this.maxRetries = EMAIL_CONFIG.DEFAULT_MAX_RETRIES;
    this.retryDelay = EMAIL_CONFIG.INITIAL_RETRY_DELAY_MS;
    this.emailQueue = []; // In-memory queue for emails to process
    this.isProcessingQueue = false; // Flag to prevent multiple queue processors
    this.currentlyProcessingEmailId = null; // Track which email is currently being processed
    this.maxQueueSize = EMAIL_CONFIG.ANNOUNCEMENTS.MAX_QUEUE_SIZE || 100; // Max queue size to prevent memory leak
  }

  /**
   * Add an email to the processing queue.
   * - Adds email to in-memory queue if not already queued or processing
   * - Starts queue processor if not already running and DB is connected
   * - Returns immediately (non-blocking)
   * - Uses setImmediate pattern for asynchronous queue processing
   * @param {string|ObjectId} emailId - The ObjectId of the parent Email.
   * @returns {void}
   */
  queueEmail(emailId) {
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      // logger.logException(new Error('Invalid emailId'), 'EmailProcessor.queueEmail');
      return;
    }

    const emailIdStr = emailId.toString();

    // Atomic check and add: Skip if already in queue or currently processing
    // Use includes check first for early return
    if (
      this.emailQueue.includes(emailIdStr) ||
      this.currentlyProcessingEmailId === emailIdStr ||
      this.processingBatches.has(emailIdStr)
    ) {
      // logger.logInfo(`Email ${emailIdStr} is already queued or being processed, skipping`);
      return;
    }

    // Check queue size to prevent memory leak
    if (this.emailQueue.length >= this.maxQueueSize) {
      // logger.logException(
      //   new Error(`Email queue is full (${this.maxQueueSize}). Rejecting new email.`),
      //   'EmailProcessor.queueEmail - Queue overflow',
      // );
      // Remove oldest entries if queue is full (FIFO - keep newest)
      const removeCount = Math.floor(this.maxQueueSize * 0.1); // Remove 10% of old entries
      this.emailQueue.splice(0, removeCount);
      // logger.logInfo(`Removed ${removeCount} old entries from queue to make room`);
    }

    // Add to queue (atomic operation - push is atomic in single-threaded JS)
    this.emailQueue.push(emailIdStr);
    // logger.logInfo(`Email ${emailIdStr} added to queue. Queue length: ${this.emailQueue.length}`);

    // Start queue processor if not already running
    if (!this.isProcessingQueue) {
      setImmediate(() => {
        // eslint-disable-next-line no-unused-vars
        this.processQueue().catch((error) => {
          // logger.logException(error, 'Error in queue processor');
          // Reset flag so queue can restart on next email addition
          this.isProcessingQueue = false;
        });
      });
    }
  }

  /**
   * Process the email queue sequentially.
   * - Processes one email at a time
   * - Once an email is done, processes the next one
   * - Continues until queue is empty
   * - Database connection is ensured at startup (server.js waits for DB connection)
   * - Uses atomic check-and-set pattern to prevent race conditions
   * @returns {Promise<void>}
   */
  async processQueue() {
    // Atomic check-and-set: if already processing, return immediately
    // In single-threaded Node.js, this is safe because the check and set happen synchronously
    if (this.isProcessingQueue) {
      return; // Already processing
    }

    // Set flag synchronously before any async operations to prevent race conditions
    this.isProcessingQueue = true;
    // logger.logInfo('Email queue processor started');

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Get next email from queue (FIFO)
        const emailId = this.emailQueue.shift();
        if (!emailId) {
          break;
        }

        this.currentlyProcessingEmailId = emailId;
        // logger.logInfo(
        //   `Processing email ${emailId} from queue. Remaining: ${this.emailQueue.length}`,
        // );

        try {
          // Process the email (this processes all its batches)
          // Sequential processing is required - await in loop is necessary
          // eslint-disable-next-line no-await-in-loop
          await this.processEmail(emailId);
          // logger.logInfo(`Email ${emailId} processing completed`);
        } catch (error) {
          // logger.logException(error, `Error processing email ${emailId} from queue`);
        } finally {
          this.currentlyProcessingEmailId = null;
        }

        // Small delay before processing next email to avoid overwhelming the system
        if (this.emailQueue.length > 0) {
          // eslint-disable-next-line no-await-in-loop
          await EmailProcessor.sleep(100);
        }
      }
    } finally {
      this.isProcessingQueue = false;
      // logger.logInfo('Email queue processor stopped');
    }
  }

  /**
   * Process a single parent Email by sending all of its pending EmailBatch items.
   * - Processes all batches for the email sequentially (with concurrency within batches)
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

    const emailIdStr = emailId.toString();

    // Atomic check-and-add to prevent race condition: prevent concurrent processing of the same email
    // Check first, then add atomically (in single-threaded JS, this is safe between async operations)
    if (this.processingBatches.has(emailIdStr)) {
      // logger.logInfo(`Email ${emailIdStr} is already being processed, skipping`);
      return EMAIL_CONFIG.EMAIL_STATUSES.SENDING;
    }

    // Add to processing set BEFORE any async operations to prevent race conditions
    // This ensures no other processEmail call can start while this one is initializing
    this.processingBatches.add(emailIdStr);

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
        // logger.logInfo(`Email ${emailId} is already in final state: ${email.status}`);
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
          // logger.logInfo(`Email ${emailIdStr} is already being processed, skipping`);
          this.processingBatches.delete(emailIdStr);
          return EMAIL_CONFIG.EMAIL_STATUSES.SENDING;
        }
        // Re-throw if it's a different error
        throw startError;
      }

      // Process all PENDING EmailBatch items for this email
      await this.processEmailBatches(email);

      // Sync parent Email status based on all batch statuses
      // Auto-sync from individual batch updates may have already updated status,
      // but this ensures final status and completedAt timestamp are set correctly
      const updatedEmail = await EmailBatchService.syncParentEmailStatus(email._id);
      const finalStatus = updatedEmail ? updatedEmail.status : EMAIL_CONFIG.EMAIL_STATUSES.FAILED;

      // logger.logInfo(`Email ${emailIdStr} processed with status: ${finalStatus}`);
      return finalStatus;
    } catch (error) {
      // logger.logException(error, `Error processing Email ${emailIdStr}`);

      // Reset any batches that were marked as SENDING back to PENDING
      // This prevents batches from being stuck in SENDING status
      try {
        const batches = await EmailBatchService.getBatchesForEmail(emailIdStr);
        const sendingBatches = batches.filter(
          (batch) => batch.status === EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENDING,
        );
        await Promise.allSettled(
          sendingBatches.map(async (batch) => {
            try {
              await EmailBatchService.resetEmailBatchForRetry(batch._id);
              // logger.logInfo(
              //   `Reset batch ${batch._id} from SENDING to PENDING due to email processing error`,
              // );
            } catch (resetError) {
              // logger.logException(resetError, `Error resetting batch ${batch._id} to PENDING`);
            }
          }),
        );
      } catch (resetError) {
        // logger.logException(resetError, `Error resetting batches for email ${emailIdStr}`);
      }

      // Sync parent Email status based on actual batch states (not just mark as FAILED)
      // This ensures status accurately reflects batches that may have succeeded before the error
      try {
        const updatedEmail = await EmailBatchService.syncParentEmailStatus(emailIdStr);
        const finalStatus = updatedEmail ? updatedEmail.status : EMAIL_CONFIG.EMAIL_STATUSES.FAILED;
        return finalStatus;
      } catch (updateError) {
        // If sync fails, fall back to marking as FAILED
        // logger.logException(updateError, 'Error syncing Email status after error');
        try {
          await EmailService.markEmailCompleted(emailIdStr, EMAIL_CONFIG.EMAIL_STATUSES.FAILED);
        } catch (markError) {
          // logger.logException(markError, 'Error updating Email status to failed');
        }
        return EMAIL_CONFIG.EMAIL_STATUSES.FAILED;
      }
    } finally {
      this.processingBatches.delete(emailIdStr);
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
      // logger.logInfo(`No PENDING EmailBatch items found for Email ${email._id}`);
      return;
    }

    // logger.logInfo(
    //   `Processing ${pendingBatches.length} PENDING EmailBatch items for Email ${email._id}`,
    // );

    // Process items with concurrency limit
    const concurrency = EMAIL_CONFIG.ANNOUNCEMENTS.CONCURRENCY || 3;
    const delayBetweenChunks = EMAIL_CONFIG.ANNOUNCEMENTS.DELAY_BETWEEN_CHUNKS_MS || 1000;
    const batchStaggerStart = EMAIL_CONFIG.ANNOUNCEMENTS.BATCH_STAGGER_START_MS || 0;
    const results = [];

    // Process batches in chunks with concurrency control
    // eslint-disable-next-line no-await-in-loop
    for (let i = 0; i < pendingBatches.length; i += concurrency) {
      const batchChunk = pendingBatches.slice(i, i + concurrency);

      // Process batches with optional staggered start delays within the chunk
      // This staggers when each batch in the chunk starts processing (helps with rate limiting)
      const batchPromises = batchChunk.map((item, index) => {
        if (batchStaggerStart > 0 && index > 0) {
          // Stagger the start: batch 1 starts immediately, batch 2 after staggerDelay, batch 3 after 2*staggerDelay, etc.
          return EmailProcessor.sleep(batchStaggerStart * index).then(() =>
            this.processEmailBatch(item, email),
          );
        }
        // First batch in chunk starts immediately (no stagger)
        return this.processEmailBatch(item, email);
      });

      // Wait for all batches in this chunk to complete
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Add delay after this chunk completes before starting the next chunk
      // This provides consistent pacing to prevent hitting Gmail rate limits
      if (delayBetweenChunks > 0 && i + concurrency < pendingBatches.length) {
        // eslint-disable-next-line no-await-in-loop
        await EmailProcessor.sleep(delayBetweenChunks);
      }
    }

    // Log summary of processing
    // const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    // const failed = results.filter((r) => r.status === 'rejected').length;

    // logger.logInfo(
    //   `Completed processing ${pendingBatches.length} EmailBatch items for Email ${email._id}: ${succeeded} succeeded, ${failed} failed`,
    // );
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
      // logger.logException(
      //   new Error('No valid recipients found'),
      //   `EmailBatch item ${item._id} has no valid recipients`,
      // );
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
            // logger.logInfo(
            //   `EmailBatch ${item._id} is already ${currentBatch.status}, skipping duplicate processing`,
            // );
            return; // Skip this batch
          }
        }
      } catch (batchError) {
        // If batch not found or invalid ID, log and re-throw original error
        // logger.logException(batchError, `Error checking EmailBatch ${item._id} status`);
      }
      // Re-throw if it's a different error
      throw markError;
    }

    // Build mail options with sender name
    const senderName = EMAIL_CONFIG.EMAIL.SENDER_NAME;
    const senderEmail = EMAIL_CONFIG.EMAIL.SENDER;
    const fromField = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

    const mailOptions = {
      from: fromField,
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
        sendResponse: sendResult.response, // Store the full response from email API
      });
      // logger.logInfo(
      //   `EmailBatch item ${item._id} sent successfully to ${recipientEmails.length} recipients (attempts ${actualAttemptCount})`,
      // );
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

    // logger.logInfo(
    //   `Permanently failed to send EmailBatch item ${item._id} to ${recipientEmails.length} recipients after ${actualAttemptCount} attempts`,
    // );
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
   * Get lightweight processor status for diagnostics/telemetry.
   * @returns {{isRunning: boolean, processingBatches: string[], maxRetries: number, queueLength: number, currentlyProcessing: string|null, isProcessingQueue: boolean}}
   */
  getStatus() {
    return {
      isRunning: true,
      processingBatches: Array.from(this.processingBatches),
      maxRetries: this.maxRetries,
      queueLength: this.emailQueue.length,
      currentlyProcessing: this.currentlyProcessingEmailId,
      isProcessingQueue: this.isProcessingQueue,
    };
  }

  /**
   * Process pending and stuck emails on system startup.
   * - Called only after database connection is established (server.js uses mongoose.connection.once('connected'))
   * - Resets stuck emails (SENDING status) to PENDING
   * - Resets stuck batches (SENDING status) to PENDING
   * - Queues all PENDING emails for processing
   * @returns {Promise<void>}
   */
  async processPendingAndStuckEmails() {
    try {
      // logger.logInfo('Starting startup processing of pending and stuck emails...');

      // Step 1: Reset stuck emails to PENDING
      const stuckEmails = await EmailService.getStuckEmails();
      if (stuckEmails.length > 0) {
        // logger.logInfo(`Found ${stuckEmails.length} stuck emails, resetting to PENDING...`);
        await Promise.allSettled(
          stuckEmails.map(async (email) => {
            try {
              await EmailService.resetStuckEmail(email._id);
              // logger.logInfo(`Reset stuck email ${email._id} to PENDING`);
            } catch (error) {
              // logger.logException(error, `Error resetting stuck email ${email._id}`);
            }
          }),
        );
      }

      // Step 2: Reset stuck batches to PENDING
      const stuckBatches = await EmailBatchService.getStuckBatches();
      if (stuckBatches.length > 0) {
        // logger.logInfo(`Found ${stuckBatches.length} stuck batches, resetting to PENDING...`);
        await Promise.allSettled(
          stuckBatches.map(async (batch) => {
            try {
              await EmailBatchService.resetEmailBatchForRetry(batch._id);
              // logger.logInfo(`Reset stuck batch ${batch._id} to PENDING`);
            } catch (error) {
              // logger.logException(error, `Error resetting stuck batch ${batch._id}`);
            }
          }),
        );
      }

      // Step 3: Queue all PENDING emails for processing
      const pendingEmails = await EmailService.getPendingEmails();
      if (pendingEmails.length > 0) {
        // logger.logInfo(`Found ${pendingEmails.length} pending emails, adding to queue...`);
        // Queue all emails (non-blocking, sequential processing)
        pendingEmails.forEach((email) => {
          this.queueEmail(email._id);
        });
        // logger.logInfo(`Queued ${pendingEmails.length} pending emails for processing`);
      } else {
        // logger.logInfo('No pending emails found on startup');
      }

      // logger.logInfo('Startup processing of pending and stuck emails completed');
    } catch (error) {
      // logger.logException(error, 'Error during startup processing of pending and stuck emails');
    }
  }
}

// Create singleton instance
const emailProcessor = new EmailProcessor();

module.exports = emailProcessor;
