/**
 * Email Batch Service - Manages EmailBatch items (child records)
 * Focus: Creating and managing EmailBatch items that reference parent Email records
 */

const mongoose = require('mongoose');
const EmailBatch = require('../../../models/emailBatch');
const Email = require('../../../models/email');
const { EMAIL_CONFIG } = require('../../../config/emailConfig');
const {
  normalizeRecipientsToObjects,
  isValidEmailAddress,
} = require('../../../utilities/emailValidators');
const logger = require('../../../startup/logger');

class EmailBatchService {
  /**
   * Create EmailBatch items for a parent Email.
   * - Validates parent Email ID, normalizes recipients and chunks by configured size.
   * - Returns inserted EmailBatch documents.
   * @param {string|ObjectId} emailId - Parent Email ObjectId.
   * @param {Array<{email: string}|string>} recipients - Recipients (auto-normalized).
   * @param {{batchSize?: number, emailType?: 'TO'|'CC'|'BCC'}} config - Optional overrides.
   * @param {import('mongoose').ClientSession|null} session - Optional transaction session.
   * @returns {Promise<Array>} Created EmailBatch items.
   */
  static async createEmailBatches(emailId, recipients, config = {}, session = null) {
    try {
      // emailId is now the ObjectId directly - validate it
      if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
        const error = new Error(`Email not found with id: ${emailId}`);
        error.statusCode = 404;
        throw error;
      }

      const batchSize = config.batchSize || EMAIL_CONFIG.ANNOUNCEMENTS.BATCH_SIZE;
      const emailType = config.emailType || EMAIL_CONFIG.EMAIL_TYPES.BCC;

      // Normalize recipients to { email }
      const normalizedRecipients = normalizeRecipientsToObjects(recipients);
      if (normalizedRecipients.length === 0) {
        const error = new Error('At least one recipient is required');
        error.statusCode = 400;
        throw error;
      }

      // Validate recipient count limit
      if (normalizedRecipients.length > EMAIL_CONFIG.LIMITS.MAX_RECIPIENTS_PER_REQUEST) {
        const error = new Error(
          `A maximum of ${EMAIL_CONFIG.LIMITS.MAX_RECIPIENTS_PER_REQUEST} recipients are allowed per request`,
        );
        error.statusCode = 400;
        throw error;
      }

      // Validate email format for all recipients
      const invalidRecipients = normalizedRecipients.filter(
        (recipient) => !isValidEmailAddress(recipient.email),
      );
      if (invalidRecipients.length > 0) {
        const error = new Error('One or more recipient emails are invalid');
        error.statusCode = 400;
        error.invalidRecipients = invalidRecipients.map((r) => r.email);
        throw error;
      }

      // Chunk recipients into EmailBatch items
      const emailBatchItems = [];

      for (let i = 0; i < normalizedRecipients.length; i += batchSize) {
        const recipientChunk = normalizedRecipients.slice(i, i + batchSize);

        const emailBatchItem = {
          emailId, // emailId is now the ObjectId directly
          recipients: recipientChunk.map((recipient) => ({ email: recipient.email })),
          emailType,
          status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING,
        };

        emailBatchItems.push(emailBatchItem);
      }

      // Insert with session if provided for transaction support
      let inserted;
      try {
        inserted = await EmailBatch.insertMany(emailBatchItems, { session });
      } catch (dbError) {
        // Handle MongoDB errors
        if (dbError.name === 'ValidationError') {
          const error = new Error(`Validation error: ${dbError.message}`);
          error.statusCode = 400;
          throw error;
        }
        if (dbError.code === 11000) {
          const error = new Error('Duplicate key error');
          error.statusCode = 409;
          throw error;
        }
        // Re-throw with status code for other database errors
        dbError.statusCode = 500;
        throw dbError;
      }

      logger.logInfo(
        `Created ${emailBatchItems.length} EmailBatch items for Email ${emailId} with ${normalizedRecipients.length} total recipients`,
      );

      return inserted;
    } catch (error) {
      logger.logException(error, 'Error creating EmailBatch items');
      throw error;
    }
  }

  /**
   * Get Email with its EmailBatch items and essential metadata for UI.
   * @param {string|ObjectId} emailId - Parent Email ObjectId.
   * @returns {Promise<{email: Object, batches: Array}>}
   * @throws {Error} If email not found
   */
  static async getEmailWithBatches(emailId) {
    try {
      if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
        const error = new Error('Valid email ID is required');
        error.statusCode = 400;
        throw error;
      }

      // Get email with createdBy populated using lean for consistency
      const email = await Email.findById(emailId)
        .populate('createdBy', 'firstName lastName email')
        .lean();

      if (!email) {
        const error = new Error(`Email ${emailId} not found`);
        error.statusCode = 404;
        throw error;
      }

      const emailBatches = await this.getBatchesForEmail(emailId);

      // Transform EmailBatch items
      const transformedBatches = emailBatches.map((batch) => ({
        _id: batch._id,
        emailId: batch.emailId,
        recipients: batch.recipients || [],
        status: batch.status,
        attempts: batch.attempts || 0,
        lastAttemptedAt: batch.lastAttemptedAt,
        sentAt: batch.sentAt,
        failedAt: batch.failedAt,
        lastError: batch.lastError,
        lastErrorAt: batch.lastErrorAt,
        errorCode: batch.errorCode,
        emailType: batch.emailType,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      }));

      return {
        email,
        batches: transformedBatches,
      };
    } catch (error) {
      logger.logException(error, 'Error getting Email with batches');
      throw error;
    }
  }

  /**
   * Fetch EmailBatch items for a parent Email.
   * @param {string|ObjectId} emailId - Parent Email ObjectId.
   * @returns {Promise<Array>} Sorted ascending by createdAt.
   */
  static async getBatchesForEmail(emailId) {
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      const error = new Error('Valid email ID is required');
      error.statusCode = 400;
      throw error;
    }
    return EmailBatch.find({ emailId }).sort({ createdAt: 1 });
  }

  /**
   * Get PENDING EmailBatch items for a parent Email.
   * Used by email processor for processing.
   * @param {string|ObjectId} emailId - Parent Email ObjectId.
   * @returns {Promise<Array>} Sorted ascending by createdAt.
   */
  static async getPendingBatchesForEmail(emailId) {
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      const error = new Error('Valid email ID is required');
      error.statusCode = 400;
      throw error;
    }
    return EmailBatch.find({
      emailId,
      status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING,
    }).sort({ createdAt: 1 });
  }

  /**
   * Alias of getBatchesForEmail for naming consistency.
   */
  static async getEmailBatchesByEmailId(emailId) {
    return this.getBatchesForEmail(emailId);
  }

  /**
   * Get EmailBatch by ID.
   * @param {string|ObjectId} batchId - EmailBatch ObjectId.
   * @returns {Promise<Object|null>} EmailBatch document or null if not found.
   */
  static async getBatchById(batchId) {
    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      const error = new Error('Valid email batch ID is required');
      error.statusCode = 400;
      throw error;
    }
    return EmailBatch.findById(batchId);
  }

  /**
   * Get failed EmailBatch items for a parent Email.
   * @param {string|ObjectId} emailId - Parent Email ObjectId.
   * @returns {Promise<Array>} Array of failed EmailBatch items.
   */
  static async getFailedBatchesForEmail(emailId) {
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      const error = new Error('Valid email ID is required');
      error.statusCode = 400;
      throw error;
    }
    return EmailBatch.find({
      emailId,
      status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED,
    }).sort({ createdAt: 1 });
  }

  /**
   * Reset an EmailBatch item for retry, clearing attempts and error fields.
   * Uses atomic update to prevent race conditions.
   * @param {string|ObjectId} emailBatchId - Batch ObjectId.
   * @returns {Promise<Object>} Updated document.
   * @throws {Error} If batch not found
   */
  static async resetEmailBatchForRetry(emailBatchId) {
    if (!emailBatchId || !mongoose.Types.ObjectId.isValid(emailBatchId)) {
      const error = new Error('Valid email batch ID is required');
      error.statusCode = 400;
      throw error;
    }

    const now = new Date();
    const updated = await EmailBatch.findByIdAndUpdate(
      emailBatchId,
      {
        status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING,
        attempts: 0,
        lastError: null,
        lastErrorAt: null,
        errorCode: null,
        failedAt: null,
        lastAttemptedAt: null,
        updatedAt: now,
      },
      { new: true },
    );

    if (!updated) {
      const error = new Error(`EmailBatch ${emailBatchId} not found`);
      error.statusCode = 404;
      throw error;
    }

    return updated;
  }

  /**
   * Mark a batch item as SENDING, increment attempts, and set lastAttemptedAt.
   * Uses atomic update with condition to prevent race conditions.
   * @param {string|ObjectId} emailBatchId - Batch ObjectId.
   * @returns {Promise<Object>} Updated batch document.
   * @throws {Error} If batch not found or not in PENDING status
   */
  static async markEmailBatchSending(emailBatchId) {
    const now = new Date();
    const updated = await EmailBatch.findOneAndUpdate(
      {
        _id: emailBatchId,
        status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.PENDING,
      },
      {
        status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENDING,
        $inc: { attempts: 1 },
        lastAttemptedAt: now,
      },
      { new: true },
    );

    if (!updated) {
      const error = new Error(`EmailBatch ${emailBatchId} not found or not in PENDING status`);
      error.statusCode = 404;
      throw error;
    }

    return updated;
  }

  /**
   * Mark a batch item as SENT and set sentAt timestamp.
   * @param {string|ObjectId} emailBatchId - Batch ObjectId.
   * @param {{attemptCount?: number}} options - Optional attempt count to update.
   * @returns {Promise<Object>} Updated batch document.
   * @throws {Error} If batch not found
   */
  static async markEmailBatchSent(emailBatchId, options = {}) {
    if (!emailBatchId || !mongoose.Types.ObjectId.isValid(emailBatchId)) {
      const error = new Error('Valid email batch ID is required');
      error.statusCode = 400;
      throw error;
    }

    const now = new Date();
    const updateFields = {
      status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT,
      sentAt: now,
      updatedAt: now,
    };

    // Update attempts count if provided (to reflect actual retry attempts)
    if (options.attemptCount && options.attemptCount > 0) {
      updateFields.attempts = options.attemptCount;
    }

    const updated = await EmailBatch.findByIdAndUpdate(emailBatchId, updateFields, { new: true });

    if (!updated) {
      const error = new Error(`EmailBatch ${emailBatchId} not found`);
      error.statusCode = 404;
      throw error;
    }

    return updated;
  }

  /**
   * Mark a batch item as FAILED and snapshot the error info.
   * @param {string|ObjectId} emailBatchId - Batch ObjectId.
   * @param {{errorCode?: string, errorMessage?: string, attemptCount?: number}} param1 - Error details and attempt count.
   * @returns {Promise<Object>} Updated batch document.
   * @throws {Error} If batch not found
   */
  static async markEmailBatchFailed(emailBatchId, { errorCode, errorMessage, attemptCount }) {
    if (!emailBatchId || !mongoose.Types.ObjectId.isValid(emailBatchId)) {
      const error = new Error('Valid email batch ID is required');
      error.statusCode = 400;
      throw error;
    }

    const now = new Date();
    const updateFields = {
      status: EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED,
      failedAt: now,
      lastError: errorMessage?.slice(0, 500) || null,
      lastErrorAt: now,
      errorCode: errorCode?.toString().slice(0, 1000) || null,
      updatedAt: now,
    };

    // Update attempts count if provided (to reflect actual retry attempts)
    if (attemptCount && attemptCount > 0) {
      updateFields.attempts = attemptCount;
    }

    const updated = await EmailBatch.findByIdAndUpdate(emailBatchId, updateFields, { new: true });

    if (!updated) {
      const error = new Error(`EmailBatch ${emailBatchId} not found`);
      error.statusCode = 404;
      throw error;
    }

    return updated;
  }
}

module.exports = EmailBatchService;
