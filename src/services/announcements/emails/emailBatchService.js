/**
 * Email Batch Service - Manages EmailBatch items (child records)
 * Focus: Creating and managing EmailBatch items that reference parent Email records
 */

const mongoose = require('mongoose');
const Email = require('../../../models/email');
const EmailBatch = require('../../../models/emailBatch');
const EmailService = require('./emailService');
const { EMAIL_JOB_CONFIG } = require('../../../config/emailJobConfig');
const { normalizeRecipientsToObjects } = require('../../../utilities/emailValidators');
const logger = require('../../../startup/logger');

class EmailBatchService {
  /**
   * Create EmailBatch items for an Email
   * Takes all recipients, chunks them into EmailBatch items with configurable batch size
   * @param {string|ObjectId} emailId - The _id (ObjectId) of the parent Email
   * @param {Array} recipients - Array of recipient objects with email property
   * @param {Object} config - Configuration { batchSize?, emailType? }
   * @param {Object} session - MongoDB session for transaction support
   * @returns {Promise<Array>} Created EmailBatch items
   */
  static async createEmailBatches(emailId, recipients, config = {}, session = null) {
    try {
      // emailId is now the ObjectId directly - validate it
      if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
        throw new Error(`Email not found with id: ${emailId}`);
      }

      const batchSize = config.batchSize || EMAIL_JOB_CONFIG.ANNOUNCEMENTS.BATCH_SIZE;
      const emailType = config.emailType || EMAIL_JOB_CONFIG.EMAIL_TYPES.BCC;

      // Normalize recipients to { email }
      const normalizedRecipients = normalizeRecipientsToObjects(recipients);
      if (normalizedRecipients.length === 0) {
        throw new Error('At least one recipient is required');
      }

      // Chunk recipients into EmailBatch items
      const emailBatchItems = [];

      for (let i = 0; i < normalizedRecipients.length; i += batchSize) {
        const recipientChunk = normalizedRecipients.slice(i, i + batchSize);

        const emailBatchItem = {
          emailId, // emailId is now the ObjectId directly
          recipients: recipientChunk.map((recipient) => ({ email: recipient.email })),
          emailType,
          status: EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.QUEUED,
        };

        emailBatchItems.push(emailBatchItem);
      }

      // Insert with session if provided for transaction support
      const inserted = await EmailBatch.insertMany(emailBatchItems, { session });

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
   * Get Email with its EmailBatch items and dynamic counts
   */
  static async getEmailWithBatches(emailId) {
    try {
      const email = await EmailService.getEmailById(emailId);
      if (!email) {
        return null;
      }

      // Populate createdBy if email exists
      await email.populate('createdBy', 'firstName lastName email');

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
        email: email.toObject(),
        batches: transformedBatches,
      };
    } catch (error) {
      logger.logException(error, 'Error getting Email with batches');
      throw error;
    }
  }

  /**
   * Get all Emails
   */
  static async getAllEmails() {
    try {
      const emails = await Email.find()
        .sort({ createdAt: -1 })
        .populate('createdBy', 'firstName lastName email')
        .lean();

      return emails;
    } catch (error) {
      logger.logException(error, 'Error getting Emails');
      throw error;
    }
  }

  /**
   * Fetch EmailBatch items for a parent emailId (ObjectId)
   */
  static async getBatchesForEmail(emailId) {
    return EmailBatch.find({ emailId }).sort({ createdAt: 1 });
  }

  /**
   * Get EmailBatch items by emailId (alias for consistency)
   */
  static async getEmailBatchesByEmailId(emailId) {
    return this.getBatchesForEmail(emailId);
  }

  /**
   * Reset an EmailBatch item for retry
   */
  static async resetEmailBatchForRetry(emailBatchId) {
    const item = await EmailBatch.findById(emailBatchId);
    if (!item) return null;
    item.status = EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.QUEUED;
    item.attempts = 0;
    item.lastError = null;
    item.lastErrorAt = null;
    item.errorCode = null;
    item.failedAt = null;
    item.lastAttemptedAt = null;
    await item.save();
    return item;
  }

  /**
   * Mark a batch item as SENDING (and bump attempts/lastAttemptedAt)
   */
  static async markEmailBatchSending(emailBatchId) {
    const now = new Date();
    const updated = await EmailBatch.findByIdAndUpdate(
      emailBatchId,
      {
        status: EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENDING,
        $inc: { attempts: 1 },
        lastAttemptedAt: now,
      },
      { new: true },
    );
    return updated;
  }

  /**
   * Mark a batch item as SENT
   */
  static async markEmailBatchSent(emailBatchId) {
    const now = new Date();
    const updated = await EmailBatch.findByIdAndUpdate(
      emailBatchId,
      {
        status: EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENT,
        sentAt: now,
      },
      { new: true },
    );
    return updated;
  }

  /**
   * Mark a batch item as FAILED and record error info
   */
  static async markEmailBatchFailed(emailBatchId, { errorCode, errorMessage }) {
    const now = new Date();
    const updated = await EmailBatch.findByIdAndUpdate(
      emailBatchId,
      {
        status: EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.FAILED,
        failedAt: now,
        lastError: errorMessage?.slice(0, 500) || null,
        lastErrorAt: now,
        errorCode: errorCode?.toString().slice(0, 1000) || null,
      },
      { new: true },
    );
    return updated;
  }
}

module.exports = EmailBatchService;
