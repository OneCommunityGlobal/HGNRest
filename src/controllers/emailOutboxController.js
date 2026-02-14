const EmailBatchService = require('../services/announcements/emails/emailBatchService');
const EmailService = require('../services/announcements/emails/emailService');
const { hasPermission } = require('../utilities/permissions');
// const logger = require('../startup/logger');

/**
 * Get all announcement Email records (parent documents) - Outbox view.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getEmails = async (req, res) => {
  try {
    // Requestor validation
    if (!req?.body?.requestor?.requestorId) {
      return res.status(401).json({ success: false, message: 'Missing requestor' });
    }

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
    // logger.logException(error, 'Error getting emails');
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
    // Requestor validation
    if (!req?.body?.requestor?.requestorId) {
      return res.status(401).json({ success: false, message: 'Missing requestor' });
    }

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
    // logger.logException(error, 'Error getting Email details with EmailBatch items');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error getting email details',
    });
  }
};

module.exports = {
  getEmails,
  getEmailDetails,
};
