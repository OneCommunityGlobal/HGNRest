/**
 * Email Batch Audit Service
 * Centralized audit management for email batch operations
 */

const EmailBatchAudit = require('../models/emailBatchAudit');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');
const logger = require('../startup/logger');

class EmailBatchAuditService {
  /**
   * Log an action to the audit trail
   */
  static async logAction(
    emailId,
    action,
    details,
    metadata = {},
    error = null,
    triggeredBy = null,
    emailBatchId = null,
  ) {
    try {
      const audit = new EmailBatchAudit({
        emailId,
        emailBatchId,
        action,
        details,
        metadata,
        error: error?.message,
        errorCode: error?.code,
        triggeredBy,
      });

      await audit.save();
      return audit;
    } catch (err) {
      logger.logException(err, 'Error logging audit action');
      throw err;
    }
  }

  /**
   * Get complete audit trail for an email (main batch)
   */
  static async getEmailAuditTrail(emailId, page = 1, limit = 50, action = null) {
    const query = { emailId };

    // Add action filter if provided
    if (action) {
      query.action = action;
    }

    const skip = (page - 1) * limit;

    const auditTrail = await EmailBatchAudit.find(query)
      .sort({ timestamp: 1 })
      .populate('triggeredBy', 'firstName lastName email')
      .populate('emailBatchId', 'recipients emailType')
      .skip(skip)
      .limit(limit);

    const totalCount = await EmailBatchAudit.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    return {
      auditTrail,
      totalCount,
      page,
      totalPages,
      limit,
    };
  }

  /**
   * Get audit trail for a specific email batch item
   */
  static async getEmailBatchAuditTrail(emailBatchId, page = 1, limit = 50, action = null) {
    const query = { emailBatchId };

    // Add action filter if provided
    if (action) {
      query.action = action;
    }

    const skip = (page - 1) * limit;

    const auditTrail = await EmailBatchAudit.find(query)
      .sort({ timestamp: 1 })
      .populate('triggeredBy', 'firstName lastName email')
      .populate('emailId', 'subject batchId')
      .skip(skip)
      .limit(limit);

    const totalCount = await EmailBatchAudit.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    return {
      auditTrail,
      totalCount,
      page,
      totalPages,
      limit,
    };
  }

  /**
   * Get system-wide audit statistics
   */
  static async getAuditStats(dateFrom = null, dateTo = null) {
    const matchStage = {};
    if (dateFrom || dateTo) {
      matchStage.timestamp = {};
      if (dateFrom) matchStage.timestamp.$gte = new Date(dateFrom);
      if (dateTo) matchStage.timestamp.$lte = new Date(dateTo);
    }

    return EmailBatchAudit.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          avgProcessingTime: {
            $avg: '$processingContext.processingTime',
          },
        },
      },
    ]);
  }

  /**
   * Log email creation
   */
  static async logEmailCreated(emailId, createdBy, metadata = {}) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.BATCH_CREATED,
      `Email created with ID: ${emailId}`,
      metadata,
      null,
      createdBy,
    );
  }

  /**
   * Log email processing start
   */
  static async logEmailStarted(emailId, metadata = {}) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.BATCH_STARTED,
      `Email processing started`,
      metadata,
    );
  }

  /**
   * Log email processing completion
   */
  static async logEmailCompleted(emailId, metadata = {}) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.BATCH_COMPLETED,
      `Email processing completed successfully`,
      metadata,
    );
  }

  /**
   * Log email processing failure
   */
  static async logEmailFailed(emailId, error, metadata = {}) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.BATCH_FAILED,
      `Email processing failed`,
      metadata,
      error,
    );
  }

  /**
   * Log email batch item sent with essential delivery tracking
   */
  static async logEmailBatchSent(emailId, emailBatchId, metadata = {}, gmailResponse = null) {
    const includeApiDetails =
      process.env.NODE_ENV === 'development' || process.env.LOG_API_DETAILS === 'true';

    const enhancedMetadata = {
      ...metadata,
      // Include essential delivery tracking details
      ...(includeApiDetails && gmailResponse
        ? {
            deliveryStatus: {
              messageId: gmailResponse.messageId,
              accepted: gmailResponse.accepted,
              rejected: gmailResponse.rejected,
            },
            quotaInfo: {
              quotaRemaining: gmailResponse.quotaRemaining,
              quotaResetTime: gmailResponse.quotaResetTime,
            },
          }
        : {}),
    };

    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.ITEM_SENT,
      `Email batch item sent successfully`,
      enhancedMetadata,
      null,
      null,
      emailBatchId,
    );
  }

  /**
   * Log email batch item failure with optional Gmail API metadata
   */
  static async logEmailBatchFailed(emailId, emailBatchId, error, metadata = {}) {
    const includeApiDetails = true;

    const enhancedMetadata = {
      ...metadata,
      // Include essential error tracking details
      ...(includeApiDetails && error?.gmailResponse
        ? {
            deliveryStatus: {
              messageId: error.gmailResponse.messageId,
              accepted: error.gmailResponse.accepted,
              rejected: error.gmailResponse.rejected,
            },
            quotaInfo: {
              quotaRemaining: error.gmailResponse.quotaRemaining,
              quotaResetTime: error.gmailResponse.quotaResetTime,
            },
            errorDetails: {
              errorCode: error.gmailResponse.errorCode,
              errorMessage: error.gmailResponse.errorMessage,
            },
          }
        : {}),
    };

    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.ITEM_FAILED,
      `Email batch item failed to send`,
      enhancedMetadata,
      error,
      null,
      emailBatchId,
    );
  }
}

module.exports = EmailBatchAuditService;
