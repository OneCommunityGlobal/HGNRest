/**
 * Enhanced Email Batch Service - Production Ready with Job Queue Support
 * Focus: Efficient batching with email body storage and job queue management
 */

const { v4: uuidv4 } = require('uuid');
const Email = require('../models/email');
const EmailBatch = require('../models/emailBatch');
const EmailBatchAuditService = require('./emailBatchAuditService');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');
const logger = require('../startup/logger');

class EmailBatchService {
  constructor() {
    this.batchSize = 50; // Match emailSender batch size for efficiency
  }

  /**
   * Create a new email batch with email body and job queue support
   */
  static async createBatch(batchData) {
    try {
      const batch = new Email({
        batchId: batchData.batchId || uuidv4(),
        subject: batchData.subject,
        htmlContent: batchData.htmlContent, // Store email body
        createdBy: batchData.createdBy,
      });

      await batch.save();

      // Log batch creation to audit trail
      await EmailBatchAuditService.logEmailCreated(batch._id, batchData.createdBy, {
        batchId: batch.batchId,
        subject: batch.subject,
      });

      console.log('💾 Batch saved successfully:', {
        id: batch._id,
        batchId: batch.batchId,
        status: batch.status,
      });
      return batch;
    } catch (error) {
      logger.logException(error, 'Error creating batch');
      throw error;
    }
  }

  /**
   * Add recipients to a batch with efficient batching (uses config enums)
   */
  static async addRecipients(batchId, recipients, batchConfig = {}) {
    try {
      const batch = await Email.findOne({ batchId });
      if (!batch) {
        throw new Error('Batch not found');
      }

      const batchSize = batchConfig.batchSize || 50;
      const emailType = batchConfig.emailType || EMAIL_JOB_CONFIG.EMAIL_TYPES.BCC;

      // Create batch items with multiple recipients per item
      const batchItems = [];

      for (let i = 0; i < recipients.length; i += batchSize) {
        const recipientChunk = recipients.slice(i, i + batchSize);

        const batchItem = {
          batchId: batch._id,
          recipients: recipientChunk.map((recipient) => ({
            email: recipient.email, // Only email, no name
          })),
          emailType,
          status: EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.QUEUED,
        };

        batchItems.push(batchItem);
      }

      await EmailBatch.insertMany(batchItems);

      return batch;
    } catch (error) {
      logger.logException(error, 'Error adding recipients to batch');
      throw error;
    }
  }

  /**
   * Create a single send batch (most common use case)
   */
  static async createSingleSendBatch(emailData, user) {
    try {
      // Handle both 'to' field and direct recipients array
      let recipients;
      if (emailData.to) {
        recipients = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
      } else if (Array.isArray(emailData.recipients)) {
        recipients = emailData.recipients;
      } else {
        throw new Error('No recipients provided');
      }

      // Create batch with email body
      const batch = await this.createBatch({
        batchId: uuidv4(),
        subject: emailData.subject,
        htmlContent: emailData.html, // Store email body in batch
        createdBy: user._id || user.requestorId,
      });

      // Add recipients with efficient batching
      const batchConfig = {
        batchSize: 50, // Use standard batch size
        emailType:
          recipients.length === 1
            ? EMAIL_JOB_CONFIG.EMAIL_TYPES.TO
            : EMAIL_JOB_CONFIG.EMAIL_TYPES.BCC, // Single recipient uses TO, multiple use BCC
      };

      // Convert recipients to proper format
      const recipientObjects = recipients.map((email) => ({ email }));
      console.log('📧 Adding recipients to batch:', recipientObjects.length, 'recipients');
      await this.addRecipients(batch.batchId, recipientObjects, batchConfig);

      return batch;
    } catch (error) {
      logger.logException(error, 'Error creating single send batch');
      throw error;
    }
  }

  /**
   * Get batch with items and dynamic counts
   */
  static async getBatchWithItems(batchId) {
    try {
      const batch = await Email.findOne({ batchId }).populate(
        'createdBy',
        'firstName lastName email',
      );

      if (!batch) {
        return null;
      }

      const items = await EmailBatch.find({ batchId: batch._id }).sort({ createdAt: 1 });

      // Get dynamic counts
      const counts = await batch.getEmailCounts();

      // Return batch items as-is (each item contains multiple recipients)
      const transformedItems = items.map((item) => ({
        _id: item._id,
        recipients: item.recipients || [],
        status: item.status,
        attempts: item.attempts || 0,
        lastAttemptedAt: item.lastAttemptedAt,
        sentAt: item.sentAt,
        failedAt: item.failedAt,
        error: item.error,
        errorCode: item.errorCode,
        emailType: item.emailType,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));

      return {
        batch: {
          ...batch.toObject(),
          ...counts,
        },
        items: transformedItems,
      };
    } catch (error) {
      logger.logException(error, 'Error getting batch with items');
      throw error;
    }
  }

  /**
   * Get all batches with pagination and dynamic counts
   */
  static async getBatches(filters = {}, page = 1, limit = 20) {
    try {
      const query = {};

      if (filters.status) query.status = filters.status;
      if (filters.dateFrom) query.createdAt = { $gte: new Date(filters.dateFrom) };
      if (filters.dateTo) query.createdAt = { ...query.createdAt, $lte: new Date(filters.dateTo) };

      const skip = (page - 1) * limit;

      const [batches, total] = await Promise.all([
        Email.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .populate('createdBy', 'firstName lastName email'),
        Email.countDocuments(query),
      ]);

      // Add dynamic counts to each batch
      const batchesWithCounts = await Promise.all(
        batches.map(async (batch) => {
          const counts = await batch.getEmailCounts();
          return {
            ...batch.toObject(),
            ...counts,
          };
        }),
      );

      return {
        batches: batchesWithCounts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.logException(error, 'Error getting batches');
      throw error;
    }
  }

  /**
   * Get dashboard statistics with dynamic calculations
   */
  static async getDashboardStats() {
    try {
      const [totalBatches, pendingBatches, processingBatches, completedBatches, failedBatches] =
        await Promise.all([
          Email.countDocuments(),
          Email.countDocuments({ status: EMAIL_JOB_CONFIG.EMAIL_STATUSES.QUEUED }),
          Email.countDocuments({ status: EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENDING }),
          Email.countDocuments({ status: EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENT }),
          Email.countDocuments({ status: EMAIL_JOB_CONFIG.EMAIL_STATUSES.FAILED }),
        ]);

      // Calculate email stats dynamically from batch items
      const emailStats = await EmailBatch.aggregate([
        {
          $group: {
            _id: null,
            totalEmails: {
              $sum: { $cond: [{ $isArray: '$recipients' }, { $size: '$recipients' }, 0] },
            },
            sentEmails: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.SENT] },
                      { $isArray: '$recipients' },
                    ],
                  },
                  { $size: '$recipients' },
                  0,
                ],
              },
            },
            failedEmails: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'FAILED'] }, { $isArray: '$recipients' }] },
                  { $size: '$recipients' },
                  0,
                ],
              },
            },
          },
        },
      ]);

      const stats = emailStats[0] || { totalEmails: 0, sentEmails: 0, failedEmails: 0 };
      const successRate =
        stats.totalEmails > 0 ? Math.round((stats.sentEmails / stats.totalEmails) * 100) : 0;

      return {
        overview: {
          totalBatches,
          pendingBatches,
          processingBatches,
          completedBatches,
          failedBatches,
        },
        emailStats: {
          ...stats,
          successRate,
        },
      };
    } catch (error) {
      logger.logException(error, 'Error getting dashboard stats');
      throw error;
    }
  }
}

module.exports = EmailBatchService;
