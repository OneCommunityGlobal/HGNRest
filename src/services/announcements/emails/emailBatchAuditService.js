/**
 * Email Batch Audit Service
 * Centralized audit management for email batch operations
 */

const mongoose = require('mongoose');
const EmailBatchAudit = require('../../../models/emailBatchAudit');
const { EMAIL_JOB_CONFIG } = require('../../../config/emailJobConfig');
const logger = require('../../../startup/logger');

class EmailBatchAuditService {
  /**
   * Log an action to the email batch audit trail.
   * - Validates IDs and action enum, normalizes message fields, then persists.
   * @param {string|ObjectId} emailId
   * @param {string} action - One of EMAIL_BATCH_AUDIT_ACTIONS.*
   * @param {string} details - Human-readable details (trimmed/limited).
   * @param {Object} [metadata]
   * @param {Error|null} [error]
   * @param {string|ObjectId|null} [triggeredBy]
   * @param {string|ObjectId|null} [emailBatchId]
   * @returns {Promise<Object>} Created audit document.
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
      // Validate emailId
      if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
        throw new Error('Invalid emailId for audit log');
      }

      // Validate action is in enum
      const validActions = Object.values(EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS);
      if (!validActions.includes(action)) {
        throw new Error(`Invalid audit action: ${action}`);
      }

      // Normalize details (trim, limit length)
      const normalizedDetails =
        typeof details === 'string'
          ? details.trim().slice(0, 1000)
          : String(details || '').slice(0, 1000);

      // Normalize error message
      const errorMessage = error?.message ? String(error.message).slice(0, 1000) : null;
      const errorCode = error?.code ? String(error.code).slice(0, 50) : null;

      // Validate triggeredBy if provided
      if (triggeredBy && !mongoose.Types.ObjectId.isValid(triggeredBy)) {
        logger.logInfo(
          `Invalid triggeredBy ObjectId in audit log: ${triggeredBy} - setting to null`,
        );
        triggeredBy = null;
      }

      // Validate emailBatchId if provided
      if (emailBatchId && !mongoose.Types.ObjectId.isValid(emailBatchId)) {
        logger.logInfo(
          `Invalid emailBatchId ObjectId in audit log: ${emailBatchId} - setting to null`,
        );
        emailBatchId = null;
      }

      const audit = new EmailBatchAudit({
        emailId,
        emailBatchId,
        action,
        details: normalizedDetails,
        metadata: metadata || {},
        error: errorMessage,
        errorCode,
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
   * Get complete audit trail for a parent Email (no pagination).
   * @param {string|ObjectId} emailId - Parent Email ObjectId.
   * @returns {Promise<Array>} Sorted newest first, with basic populations.
   */
  static async getEmailAuditTrail(emailId) {
    // Validate emailId is ObjectId
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      throw new Error('emailId is required and must be a valid ObjectId');
    }

    const query = { emailId }; // Use ObjectId directly

    const auditTrail = await EmailBatchAudit.find(query)
      .sort({ timestamp: -1 }) // Most recent first
      .populate('triggeredBy', 'firstName lastName email')
      .populate('emailBatchId', 'recipients emailType status')
      .lean();

    return auditTrail;
  }

  /**
   * Get audit trail for a specific EmailBatch item (no pagination).
   * @param {string|ObjectId} emailBatchId - EmailBatch ObjectId.
   * @returns {Promise<Array>} Sorted newest first, with basic populations.
   */
  static async getEmailBatchAuditTrail(emailBatchId) {
    // Validate emailBatchId is ObjectId
    if (!emailBatchId || !mongoose.Types.ObjectId.isValid(emailBatchId)) {
      throw new Error('emailBatchId is required and must be a valid ObjectId');
    }

    const query = { emailBatchId };

    const auditTrail = await EmailBatchAudit.find(query)
      .sort({ timestamp: -1 }) // Most recent first
      .populate('triggeredBy', 'firstName lastName email')
      .populate('emailId', 'subject status')
      .lean();

    return auditTrail;
  }

  /**
   * Log Email queued (initial creation or retry).
   * @param {string|ObjectId} emailId
   * @param {Object} [metadata]
   * @param {string|ObjectId} [triggeredBy]
   */
  static async logEmailQueued(emailId, metadata = {}, triggeredBy = null) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_QUEUED,
      `Email queued for processing`,
      metadata,
      null,
      triggeredBy,
    );
  }

  /**
   * Log Email sending (processing start).
   */
  static async logEmailSending(emailId, metadata = {}) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_SENDING,
      `Email processing started`,
      metadata,
    );
  }

  /**
   * Log Email processed (processing completion).
   */
  static async logEmailProcessed(emailId, metadata = {}) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_PROCESSED,
      `Email processing completed`,
      metadata,
    );
  }

  /**
   * Log Email processing failure.
   */
  static async logEmailFailed(emailId, error, metadata = {}) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_FAILED,
      `Email processing failed`,
      metadata,
      error,
    );
  }

  /**
   * Log Email sent (all batches completed successfully).
   */
  static async logEmailSent(emailId, metadata = {}) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_SENT,
      `Email sent successfully`,
      metadata,
    );
  }

  /**
   * Log EmailBatch item sent with essential delivery tracking details.
   */
  static async logEmailBatchSent(emailId, emailBatchId, metadata = {}, gmailResponse = null) {
    const enhancedMetadata = {
      ...metadata,
      // Include essential delivery tracking details
      ...(gmailResponse
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
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_BATCH_SENT,
      `EmailBatch item sent successfully`,
      enhancedMetadata,
      null,
      null,
      emailBatchId,
    );
  }

  /**
   * Log EmailBatch item failure with optional Gmail API metadata.
   */
  static async logEmailBatchFailed(emailId, emailBatchId, error, metadata = {}) {
    const enhancedMetadata = {
      ...metadata,
      // Include essential error tracking details
      ...(error?.gmailResponse
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
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_BATCH_FAILED,
      `EmailBatch item failed to send`,
      enhancedMetadata,
      error,
      null,
      emailBatchId,
    );
  }

  /**
   * Log EmailBatch item queued.
   * @param {string|ObjectId} emailId
   * @param {string|ObjectId} emailBatchId
   * @param {Object} [metadata]
   * @param {string|ObjectId} [triggeredBy]
   */
  static async logEmailBatchQueued(emailId, emailBatchId, metadata = {}, triggeredBy = null) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_BATCH_QUEUED,
      `EmailBatch item queued`,
      metadata,
      null,
      triggeredBy,
      emailBatchId,
    );
  }

  /**
   * Log EmailBatch item sending.
   * @param {string|ObjectId} emailId
   * @param {string|ObjectId} emailBatchId
   * @param {Object} [metadata]
   */
  static async logEmailBatchSending(emailId, emailBatchId, metadata = {}) {
    return this.logAction(
      emailId,
      EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_BATCH_SENDING,
      `EmailBatch item sending`,
      metadata,
      null,
      null,
      emailBatchId,
    );
  }
}

module.exports = EmailBatchAuditService;
