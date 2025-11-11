const mongoose = require('mongoose');
const EmailBatchService = require('../services/announcements/emails/emailBatchService');
const EmailService = require('../services/announcements/emails/emailService');
const emailProcessor = require('../services/announcements/emails/emailProcessor');
const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');
const { EMAIL_CONFIG } = require('../config/emailConfig');

/**
 * Get all announcement Email records (parent documents) - Outbox view.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getEmails = async (req, res) => {
  try {
    // Permission check - viewing emails requires sendEmails permission
    const canViewEmails = await hasPermission(req.body.requestor, 'sendEmails');
    if (!canViewEmails) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not authorized to view emails.' });
    }

    const emails = await EmailService.getAllEmails();

    res.status(200).json({
      success: true,
      data: emails,
    });
  } catch (error) {
    logger.logException(error, 'Error getting emails');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error getting emails',
    });
  }
};

/**
 * Get a parent Email and its associated EmailBatch items - Outbox detail view.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getEmailDetails = async (req, res) => {
  try {
    // Permission check - viewing email details requires sendEmails permission
    const canViewEmails = await hasPermission(req.body.requestor, 'sendEmails');
    if (!canViewEmails) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not authorized to view email details.' });
    }

    const { emailId } = req.params; // emailId is now the ObjectId of parent Email

    // Service validates emailId and throws error if not found
    const result = await EmailBatchService.getEmailWithBatches(emailId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.logException(error, 'Error getting Email details with EmailBatch items');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error getting email details',
    });
  }
};

/**
 * Retry a parent Email by resetting all FAILED EmailBatch items to PENDING.
 * - Processes the email immediately asynchronously.
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
    const canRetryEmail = await hasPermission(req.body.requestor, 'sendEmails');
    if (!canRetryEmail) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not authorized to retry emails.' });
    }

    // Get the Email (service throws error if not found)
    const email = await EmailService.getEmailById(emailId, null, true);

    // Only allow retry for emails in final states (FAILED or PROCESSED)
    const allowedRetryStatuses = [
      EMAIL_CONFIG.EMAIL_STATUSES.FAILED,
      EMAIL_CONFIG.EMAIL_STATUSES.PROCESSED,
    ];

    if (!allowedRetryStatuses.includes(email.status)) {
      return res.status(400).json({
        success: false,
        message: `Email must be in FAILED or PROCESSED status to retry. Current status: ${email.status}`,
      });
    }

    // Get all FAILED EmailBatch items (service validates emailId)
    const failedItems = await EmailBatchService.getFailedBatchesForEmail(emailId);

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

    logger.logInfo(`Retrying ${failedItems.length} failed EmailBatch items: ${emailId}`);

    // Mark parent Email as PENDING for retry
    await EmailService.markEmailPending(emailId);

    // Reset each failed item to PENDING
    await Promise.all(
      failedItems.map(async (item) => {
        await EmailBatchService.resetEmailBatchForRetry(item._id);
      }),
    );

    logger.logInfo(
      `Successfully reset Email ${emailId} and ${failedItems.length} failed EmailBatch items to PENDING for retry`,
    );

    // Add email to queue for processing (non-blocking, sequential processing)
    emailProcessor.queueEmail(emailId);

    res.status(200).json({
      success: true,
      message: `Successfully reset ${failedItems.length} failed EmailBatch items for retry`,
      data: {
        emailId: email._id,
        failedItemsRetried: failedItems.length,
      },
    });
  } catch (error) {
    logger.logException(error, 'Error retrying Email');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error retrying Email',
    });
  }
};

module.exports = {
  getEmails,
  getEmailDetails,
  retryEmail,
};
