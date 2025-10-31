const mongoose = require('mongoose');
const EmailBatchService = require('../services/announcements/emails/emailBatchService');
const EmailService = require('../services/announcements/emails/emailService');
const EmailBatchAuditService = require('../services/announcements/emails/emailBatchAuditService');
const emailAnnouncementJobProcessor = require('../jobs/announcementEmailJob');
const EmailBatch = require('../models/emailBatch');
const Email = require('../models/email');
const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');

/**
 * Get all announcement Email records (parent documents).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getEmails = async (req, res) => {
  try {
    // Permission check - viewing emails requires sendEmails permission
    if (!req?.body?.requestor?.requestorId && !req?.user?.userid) {
      return res.status(401).json({ success: false, message: 'Missing requestor' });
    }

    const requestor = req.body.requestor || req.user;
    const canViewEmails = await hasPermission(requestor, 'sendEmails');
    if (!canViewEmails) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not authorized to view emails.' });
    }

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
 * Get a parent Email and its associated EmailBatch items.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getEmailDetails = async (req, res) => {
  try {
    // Permission check - viewing email details requires sendEmails permission
    if (!req?.body?.requestor?.requestorId && !req?.user?.userid) {
      return res.status(401).json({ success: false, message: 'Missing requestor' });
    }

    const requestor = req.body.requestor || req.user;
    const canViewEmails = await hasPermission(requestor, 'sendEmails');
    if (!canViewEmails) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not authorized to view email details.' });
    }

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
 * Get worker/cron status for the announcement email processor.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
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
 * Retry a parent Email by resetting all FAILED EmailBatch items to QUEUED.
 * - Queues the parent email; cron picks it up in the next cycle.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
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

    // Permission check - retrying emails requires sendEmails permission
    if (!req?.body?.requestor?.requestorId && !req?.user?.userid) {
      return res.status(401).json({ success: false, message: 'Missing requestor' });
    }

    const requestor = req.body.requestor || req.user;
    const canRetryEmail = await hasPermission(requestor, 'sendEmails');
    if (!canRetryEmail) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not authorized to retry emails.' });
    }

    // Get requestor for audit trail
    const requestorId = requestor.requestorId || requestor.userid;

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
 * Get the audit trail for a specific parent Email.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getEmailAuditTrail = async (req, res) => {
  try {
    if (!req?.body?.requestor && !req?.user) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    // Permission check - use sendEmails permission to view audits
    const requestor = req.body.requestor || req.user;
    const canViewAudits = await hasPermission(requestor, 'sendEmails');
    if (!canViewAudits) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view email audits',
      });
    }

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
 * Get the audit trail for a specific EmailBatch item.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getEmailBatchAuditTrail = async (req, res) => {
  try {
    if (!req?.body?.requestor && !req?.user) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    // Permission check - use sendEmails permission to view audits
    const requestor = req.body.requestor || req.user;
    const canViewAudits = await hasPermission(requestor, 'sendEmails');
    if (!canViewAudits) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view email audits',
      });
    }

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
