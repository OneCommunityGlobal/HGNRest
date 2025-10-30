const mongoose = require('mongoose');
const EmailBatch = require('../models/emailBatch');
const EmailService = require('./emailService');
const EmailBatchService = require('./emailBatchService');
const emailAnnouncementService = require('./emailAnnouncementService');
const EmailBatchAuditService = require('./emailBatchAuditService');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');
const logger = require('../startup/logger');

class EmailProcessor {
  constructor() {
    this.processingBatches = new Set();
    this.maxRetries = EMAIL_JOB_CONFIG.DEFAULT_MAX_RETRIES;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Process an Email (processes all its EmailBatch items)
   * @param {string|ObjectId} emailId - The _id (ObjectId) of the parent Email
   */
  async processEmail(emailId) {
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      throw new Error('emailId is required and must be a valid ObjectId');
    }

    if (this.processingBatches.has(emailId)) {
      logger.logInfo(`Email ${emailId} is already being processed, skipping`);
      return EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENDING;
    }

    this.processingBatches.add(emailId);

    try {
      const email = await EmailService.getEmailById(emailId);
      if (!email) {
        throw new Error(`Email not found with id: ${emailId}`);
      }

      // Skip if already in final state
      if (
        email.status === EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENT ||
        email.status === EMAIL_JOB_CONFIG.EMAIL_STATUSES.FAILED
      ) {
        logger.logInfo(`Email ${emailId} is already in final state: ${email.status}`);
        return email.status;
      }

      // If email is already SENDING (recovery from crash), skip marking as started
      // Otherwise, mark as started and audit
      if (email.status !== EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENDING) {
        await EmailService.markEmailStarted(emailId);
        try {
          await EmailBatchAuditService.logEmailSending(email._id, {
            subject: email.subject,
          });
        } catch (auditErr) {
          logger.logException(auditErr, 'Audit failure: EMAIL_SENDING');
        }
      } else {
        logger.logInfo(`Recovering Email ${emailId} from SENDING state (from crash/restart)`);
      }

      // Process all EmailBatch items
      await this.processEmailBatches(email);

      // Determine final status based on batch items
      const finalStatus = await EmailProcessor.determineEmailStatus(email._id);
      await EmailService.markEmailCompleted(emailId, finalStatus);
      // Audit completion at email level
      try {
        if (finalStatus === EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENT) {
          await EmailBatchAuditService.logEmailSent(email._id);
        } else if (finalStatus === EMAIL_JOB_CONFIG.EMAIL_STATUSES.PROCESSED) {
          await EmailBatchAuditService.logEmailProcessed(email._id);
        } else if (finalStatus === EMAIL_JOB_CONFIG.EMAIL_STATUSES.FAILED) {
          await EmailBatchAuditService.logEmailFailed(email._id, new Error('Processing failed'));
        }
      } catch (auditErr) {
        logger.logException(auditErr, 'Audit failure: EMAIL completion');
      }

      logger.logInfo(`Email ${emailId} processed with status: ${finalStatus}`);
      return finalStatus;
    } catch (error) {
      logger.logException(error, `Error processing Email ${emailId}`);

      // Mark email as failed on error
      try {
        await EmailService.markEmailCompleted(emailId, EMAIL_JOB_CONFIG.EMAIL_STATUSES.FAILED);
        // Audit failure
        try {
          const failedEmail = await EmailService.getEmailById(emailId);
          if (failedEmail) {
            await EmailBatchAuditService.logEmailFailed(failedEmail._id, error);
          }
        } catch (auditErr) {
          logger.logException(auditErr, 'Audit failure: EMAIL_FAILED');
        }
      } catch (updateError) {
        logger.logException(updateError, 'Error updating Email status to failed');
      }
      return EMAIL_JOB_CONFIG.EMAIL_STATUSES.FAILED;
    } finally {
      this.processingBatches.delete(emailId);
    }
  }

  /**
   * Process all EmailBatch items for an Email
   * Processes ALL QUEUED items regardless of individual failures - ensures maximum delivery
   * @param {Object} email - The Email document
   */
  async processEmailBatches(email) {
    // Get ALL batches for this email first
    const allBatches = await EmailBatch.find({
      emailId: email._id,
    });

    if (allBatches.length === 0) {
      logger.logInfo(`No EmailBatch items found for Email ${email._id}`);
      return;
    }

    // Separate batches by status
    // If we're processing this Email, any SENDING EmailBatch items are considered stuck
    const stuckSendingBatches = allBatches.filter(
      (batch) => batch.status === EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENDING,
    );

    const queuedBatches = allBatches.filter(
      (batch) => batch.status === EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.QUEUED,
    );

    // Reset stuck SENDING batches to QUEUED
    if (stuckSendingBatches.length > 0) {
      logger.logInfo(
        `Resetting ${stuckSendingBatches.length} EmailBatch items stuck in SENDING state for Email ${email._id}`,
      );
      await Promise.all(
        stuckSendingBatches.map(async (batch) => {
          await EmailBatchService.resetEmailBatchForRetry(batch._id);

          // Audit recovery
          try {
            await EmailBatchAuditService.logAction(
              email._id,
              EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_BATCH_QUEUED,
              'EmailBatch item reset from SENDING state (crash/restart recovery)',
              { reason: 'Recovery from stuck SENDING state', recoveryTime: new Date() },
              null,
              null,
              batch._id,
            );
          } catch (auditErr) {
            logger.logException(auditErr, 'Audit failure: EMAIL_BATCH_QUEUED (recovery)');
          }
        }),
      );

      // Add reset batches to queued list for processing
      queuedBatches.push(...stuckSendingBatches);
    }

    if (queuedBatches.length === 0) {
      logger.logInfo(`No EmailBatch items to process for Email ${email._id}`);
      return;
    }

    logger.logInfo(`Processing ${queuedBatches.length} EmailBatch items for Email ${email._id}`);

    // Process items with concurrency limit, but use Promise.allSettled to ensure ALL items are attempted
    const concurrency = EMAIL_JOB_CONFIG.ANNOUNCEMENTS.CONCURRENCY || 3;
    const results = [];

    // eslint-disable-next-line no-await-in-loop
    for (let i = 0; i < queuedBatches.length; i += concurrency) {
      const batch = queuedBatches.slice(i, i + concurrency);
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.allSettled(
        batch.map((item) => this.processEmailBatch(item, email)),
      );
      results.push(...batchResults);
    }

    // Log summary of all processing attempts
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.logInfo(
      `Completed processing ${queuedBatches.length} EmailBatch items for Email ${email._id}: ${succeeded} succeeded, ${failed} failed`,
    );
  }

  /**
   * Process a single EmailBatch item with multiple recipients
   * @param {Object} item - The EmailBatch item
   * @param {Object} email - The parent Email document
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
      const failedItem = await EmailBatchService.markEmailBatchFailed(item._id, {
        errorCode: 'NO_RECIPIENTS',
        errorMessage: 'No valid recipients found',
      });

      // Audit logging
      try {
        await EmailBatchAuditService.logEmailBatchFailed(
          item.emailId,
          item._id,
          { message: failedItem.lastError, code: failedItem.errorCode },
          {
            recipientCount: failedItem?.recipients?.length || 0,
            emailType: failedItem?.emailType,
            recipients: failedItem?.recipients?.map((r) => r.email) || [],
            emailBatchId: failedItem?._id.toString(),
          },
        );
      } catch (auditError) {
        logger.logException(auditError, 'Audit failure: EMAIL_BATCH_FAILED');
      }
      return;
    }

    const processWithRetry = async (attempt = 1) => {
      try {
        // Mark as SENDING using service method
        const updatedItem = await EmailBatchService.markEmailBatchSending(item._id);

        // Audit logging after successful status update
        try {
          await EmailBatchAuditService.logEmailBatchSending(item.emailId, item._id, {
            attempt: updatedItem?.attempts || attempt,
            recipientCount: updatedItem?.recipients?.length || 0,
            emailType: updatedItem?.emailType,
            recipients: updatedItem?.recipients?.map((r) => r.email) || [],
            emailBatchId: updatedItem?._id.toString(),
          });
        } catch (auditError) {
          logger.logException(auditError, 'Audit failure: EMAIL_BATCH_SENDING');
        }

        // Send email directly via service (no retries here - handled by processWithRetry)
        // Use the emailType stored in the EmailBatch item
        const mailOptions = {
          from: process.env.REACT_APP_EMAIL,
          subject: email.subject,
          html: email.htmlContent,
        };

        // Set recipients based on emailType
        if (item.emailType === EMAIL_JOB_CONFIG.EMAIL_TYPES.BCC) {
          // For BCC, sender goes in 'to' field, all recipients in 'bcc'
          mailOptions.to = process.env.REACT_APP_EMAIL;
          mailOptions.bcc = recipientEmails.join(',');
        } else {
          // For TO/CC, recipients go in respective fields
          mailOptions.to = recipientEmails.join(',');
        }

        const sendResult = await emailAnnouncementService.sendEmail(mailOptions);

        // Handle result: { success, response?, error? }
        if (sendResult.success) {
          await EmailBatchService.markEmailBatchSent(item._id);
          try {
            await EmailBatchAuditService.logEmailBatchSent(
              email._id,
              item._id,
              {
                recipientCount: recipientEmails.length,
                emailType: item.emailType,
                attempt: updatedItem?.attempts || attempt,
              },
              sendResult.response,
            );
          } catch (auditError) {
            logger.logException(auditError, 'Audit failure: EMAIL_BATCH_SENT');
          }
          logger.logInfo(
            `EmailBatch item ${item._id} sent successfully to ${recipientEmails.length} recipients (attempt ${updatedItem?.attempts || attempt})`,
          );
        } else {
          // Consider as failure for this attempt
          throw sendResult.error || new Error('Failed to send email');
        }
      } catch (error) {
        logger.logException(
          error,
          `Failed to send EmailBatch item ${item._id} to ${recipientEmails.length} recipients (attempt ${attempt})`,
        );

        if (attempt >= this.maxRetries) {
          // Mark as FAILED using service method
          const failedItem = await EmailBatchService.markEmailBatchFailed(item._id, {
            errorCode: error.code || 'SEND_FAILED',
            errorMessage: error.message || 'Failed to send email',
          });

          // Audit logging
          try {
            await EmailBatchAuditService.logEmailBatchFailed(
              item.emailId,
              item._id,
              { message: failedItem.lastError, code: failedItem.errorCode },
              {
                recipientCount: failedItem?.recipients?.length || 0,
                emailType: failedItem?.emailType,
                recipients: failedItem?.recipients?.map((r) => r.email) || [],
                emailBatchId: failedItem?._id.toString(),
              },
            );
          } catch (auditError) {
            logger.logException(auditError, 'Audit failure: EMAIL_BATCH_FAILED');
          }

          logger.logInfo(
            `Permanently failed to send EmailBatch item ${item._id} to ${recipientEmails.length} recipients after ${this.maxRetries} attempts`,
          );
          // Throw error so Promise.allSettled can distinguish failed from successful items
          // This ensures accurate reporting in the summary log
          throw error;
        }

        // Log transient failure for this attempt (best-effort, not changing DB status)
        try {
          await EmailBatchAuditService.logEmailBatchFailed(email._id, item._id, error, {
            recipientCount: recipientEmails.length,
            emailType: item.emailType,
            attempt,
            transient: true,
          });
        } catch (auditError) {
          logger.logException(auditError, 'Audit failure: EMAIL_BATCH_FAILED (transient)');
        }

        // Wait before retry with exponential backoff (2^n: 1x, 2x, 4x, 8x, ...)
        const delay = this.retryDelay * 2 ** (attempt - 1);
        await EmailProcessor.sleep(delay);
        return processWithRetry(attempt + 1);
      }
    };

    return processWithRetry(1);
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
   * Determine final status for an Email based on its EmailBatch items
   */
  static async determineEmailStatus(emailObjectId) {
    const counts = await EmailBatch.aggregate([
      { $match: { emailId: emailObjectId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusMap = counts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const queued = statusMap[EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.QUEUED] || 0;
    const sending = statusMap[EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENDING] || 0;
    const sent = statusMap[EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENT] || 0;
    const failed = statusMap[EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.FAILED] || 0;

    // All sent = SENT
    if (sent > 0 && queued === 0 && sending === 0 && failed === 0) {
      return EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENT;
    }

    // All failed = FAILED
    if (failed > 0 && queued === 0 && sending === 0 && sent === 0) {
      return EMAIL_JOB_CONFIG.EMAIL_STATUSES.FAILED;
    }

    // Mixed results = PROCESSED
    if (sent > 0 || failed > 0) {
      return EMAIL_JOB_CONFIG.EMAIL_STATUSES.PROCESSED;
    }

    // Still processing = keep current status
    return EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENDING;
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
const emailProcessor = new EmailProcessor();

module.exports = emailProcessor;
