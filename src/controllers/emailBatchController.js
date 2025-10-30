const mongoose = require('mongoose');
const EmailBatchService = require('../services/emailBatchService');
const EmailService = require('../services/emailService');
const EmailBatchAuditService = require('../services/emailBatchAuditService');
const emailAnnouncementJobProcessor = require('../jobs/emailAnnouncementJobProcessor');
const EmailBatch = require('../models/emailBatch');
const Email = require('../models/email');
const logger = require('../startup/logger');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');

/**
 * Get all Email records (parent)
 */
const getEmails = async (req, res) => {
  try {
    const emails = await EmailBatchService.getAllEmails();

    res.status(200).json({
      success: true,
      data: emails,
    });
  } catch (error) {
    logger.logException(error, 'Error getting emails');
    res.status(500).json({
      success: false,
      message: 'Error getting emails',
      error: error.message,
    });
  }
};

/**
 * Get Email details with EmailBatch items
 */
const getEmailDetails = async (req, res) => {
  try {
    const { emailId } = req.params; // emailId is now the ObjectId of parent Email

    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid Email ID is required',
      });
    }

    const result = await EmailBatchService.getEmailWithBatches(emailId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Email not found',
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.logException(error, 'Error getting Email details with EmailBatch items');
    res.status(500).json({
      success: false,
      message: 'Error getting email details',
      error: error.message,
    });
  }
};

/**
 * Get worker status (minimal info for frontend)
 */
const getWorkerStatus = async (req, res) => {
  try {
    const workerStatus = emailAnnouncementJobProcessor.getWorkerStatus();

    res.status(200).json({
      success: true,
      data: workerStatus,
    });
  } catch (error) {
    logger.logException(error, 'Error getting worker status');
    res.status(500).json({
      success: false,
      message: 'Error getting worker status',
      error: error.message,
    });
  }
};

/**
 * Retry an Email by queuing all its failed EmailBatch items
 * Resets failed items to QUEUED status for the cron job to process
 */
const retryEmail = async (req, res) => {
  try {
    const { emailId } = req.params;

    // Validate emailId is a valid ObjectId
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Email ID',
      });
    }

    // Get requestor for audit trail
    const requestorId = req?.body?.requestor?.requestorId || null;

    // Find the Email
    const email = await Email.findById(emailId);

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found',
      });
    }

    // Only allow retry for emails in final states (FAILED or PROCESSED)
    const allowedRetryStatuses = [
      EMAIL_JOB_CONFIG.EMAIL_STATUSES.FAILED,
      EMAIL_JOB_CONFIG.EMAIL_STATUSES.PROCESSED,
    ];

    if (!allowedRetryStatuses.includes(email.status)) {
      return res.status(400).json({
        success: false,
        message: `Email must be in FAILED or PROCESSED status to retry. Current status: ${email.status}`,
      });
    }

    // Find all FAILED EmailBatch items
    const failedItems = await EmailBatch.find({
      emailId: email._id,
      status: EMAIL_JOB_CONFIG.EMAIL_BATCH_STATUSES.FAILED,
    });

    if (failedItems.length === 0) {
      logger.logInfo(`Email ${emailId} has no failed EmailBatch items to retry`);
      return res.status(200).json({
        success: true,
        message: 'No failed EmailBatch items to retry',
        data: {
          emailId: email._id,
          failedItemsRetried: 0,
        },
      });
    }

    logger.logInfo(`Queuing ${failedItems.length} failed EmailBatch items for retry: ${emailId}`);

    // First, queue the parent Email so cron picks it up
    await EmailService.markEmailQueued(emailId);

    // Audit Email queued for retry (with requestor)
    try {
      await EmailBatchAuditService.logEmailQueued(
        email._id,
        { reason: 'Manual retry' },
        requestorId,
      );
    } catch (auditErr) {
      logger.logException(auditErr, 'Audit failure: EMAIL_QUEUED (retry)');
    }

    // Reset each failed item to QUEUED
    await Promise.all(
      failedItems.map(async (item) => {
        await EmailBatchService.resetEmailBatchForRetry(item._id);

        // Audit retry queueing
        try {
          await EmailBatchAuditService.logAction(
            email._id,
            EMAIL_JOB_CONFIG.EMAIL_BATCH_AUDIT_ACTIONS.EMAIL_BATCH_QUEUED,
            'EmailBatch item queued for retry',
            { reason: 'Manual retry' },
            null,
            requestorId,
            item._id,
          );
        } catch (auditErr) {
          logger.logException(auditErr, 'Audit failure: EMAIL_BATCH_QUEUED (retry)');
        }
      }),
    );

    logger.logInfo(
      `Successfully queued Email ${emailId} and ${failedItems.length} failed EmailBatch items for retry`,
    );

    res.status(200).json({
      success: true,
      message: `Successfully queued ${failedItems.length} failed EmailBatch items for retry`,
      data: {
        emailId: email._id,
        failedItemsRetried: failedItems.length,
      },
    });
  } catch (error) {
    logger.logException(error, 'Error retrying Email');
    res.status(500).json({
      success: false,
      message: 'Error retrying Email',
      error: error.message,
    });
  }
};

/**
 * Get audit trail for a specific Email
 */
const getEmailAuditTrail = async (req, res) => {
  try {
    if (!req?.body?.requestor && !req?.user) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    // TODO: Re-enable permission check in future
    // Permission check - commented out for now
    // const requestor = req.body.requestor || req.user;
    // const canViewAudits = await hasPermission(requestor, 'viewEmailAudits');
    // if (!canViewAudits) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'You are not authorized to view email audits',
    //   });
    // }

    const { emailId } = req.params;

    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid Email ID is required',
      });
    }

    let auditTrail;
    try {
      auditTrail = await EmailBatchAuditService.getEmailAuditTrail(emailId);
    } catch (serviceError) {
      // Handle validation errors from service
      if (serviceError.message.includes('required') || serviceError.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          message: serviceError.message,
        });
      }
      throw serviceError;
    }

    res.status(200).json({
      success: true,
      data: auditTrail,
    });
  } catch (error) {
    logger.logException(error, 'Error getting email audit trail');
    res.status(500).json({
      success: false,
      message: 'Error getting email audit trail',
      error: error.message,
    });
  }
};

/**
 * Get audit trail for a specific EmailBatch item
 */
const getEmailBatchAuditTrail = async (req, res) => {
  try {
    if (!req?.body?.requestor && !req?.user) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    // TODO: Re-enable permission check in future
    // Permission check - commented out for now
    // const requestor = req.body.requestor || req.user;
    // const canViewAudits = await hasPermission(requestor, 'viewEmailAudits');
    // if (!canViewAudits) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'You are not authorized to view email audits',
    //   });
    // }

    const { emailBatchId } = req.params;

    // Validate emailBatchId is a valid ObjectId
    if (!emailBatchId || !mongoose.Types.ObjectId.isValid(emailBatchId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid EmailBatch ID',
      });
    }

    let auditTrail;
    try {
      auditTrail = await EmailBatchAuditService.getEmailBatchAuditTrail(emailBatchId);
    } catch (serviceError) {
      // Handle validation errors from service
      if (serviceError.message.includes('required') || serviceError.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          message: serviceError.message,
        });
      }
      throw serviceError;
    }

    res.status(200).json({
      success: true,
      data: auditTrail,
    });
  } catch (error) {
    logger.logException(error, 'Error getting email batch audit trail');
    res.status(500).json({
      success: false,
      message: 'Error getting email batch audit trail',
      error: error.message,
    });
  }
};

module.exports = {
  getEmails,
  getEmailDetails,
  getWorkerStatus,
  retryEmail,
  getEmailAuditTrail,
  getEmailBatchAuditTrail,
};
