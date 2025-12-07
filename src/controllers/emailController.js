// emailController.js
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const emailSender = require('../utilities/emailSender');
const { EMAIL_CONFIG } = require('../config/emailConfig');
const { isValidEmailAddress, normalizeRecipientsToArray } = require('../utilities/emailValidators');
const EmailTemplateService = require('../services/announcements/emails/emailTemplateService');
const EmailSubcriptionList = require('../models/emailSubcriptionList');
const userProfile = require('../models/userProfile');
const EmailBatchService = require('../services/announcements/emails/emailBatchService');
const EmailService = require('../services/announcements/emails/emailService');
const emailProcessor = require('../services/announcements/emails/emailProcessor');
const { hasPermission } = require('../utilities/permissions');
const { withTransaction } = require('../utilities/transactionHelper');
const config = require('../config');
// const logger = require('../startup/logger');

const jwtSecret = process.env.JWT_SECRET;

/**
 * Create an announcement Email for provided recipients.
 * - Validates permissions, subject/html, recipients, and template variables.
 * - Creates parent Email and chunked EmailBatch items in a transaction.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const sendEmail = async (req, res) => {
  // Requestor is required for permission check
  if (!req?.body?.requestor?.requestorId) {
    return res.status(401).json({ success: false, message: 'Missing requestor' });
  }

  // Permission check
  const canSendEmail = await hasPermission(req.body.requestor, 'sendEmails');
  if (!canSendEmail) {
    return res
      .status(403)
      .json({ success: false, message: 'You are not authorized to send emails.' });
  }

  try {
    const { to, subject, html } = req.body;

    // Validate that all template variables have been replaced (business rule)
    const unmatchedVariablesHtml = EmailTemplateService.getUnreplacedVariables(html);
    const unmatchedVariablesSubject = EmailTemplateService.getUnreplacedVariables(subject);
    const unmatchedVariables = [
      ...new Set([...unmatchedVariablesHtml, ...unmatchedVariablesSubject]),
    ];
    if (unmatchedVariables.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Email contains unreplaced template variables. Please ensure all variables are replaced before sending.',
        unmatchedVariables,
      });
    }

    // Get user
    const user = await userProfile.findById(req.body.requestor.requestorId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Requestor not found' });
    }

    // Normalize recipients once for service and response
    const recipientsArray = normalizeRecipientsToArray(to);

    // Create email and batches in transaction (validation happens in services)
    const email = await withTransaction(async (session) => {
      // Create parent Email (validates subject, htmlContent, createdBy)
      const createdEmail = await EmailService.createEmail(
        {
          subject,
          htmlContent: html,
          createdBy: user._id,
        },
        session,
      );

      // Create EmailBatch items with all recipients (validates recipients, counts, email format)
      // Enforce recipient limit for specific recipient requests
      const recipientObjects = recipientsArray.map((emailAddr) => ({ email: emailAddr }));
      await EmailBatchService.createEmailBatches(
        createdEmail._id,
        recipientObjects,
        {
          emailType: EMAIL_CONFIG.EMAIL_TYPES.BCC,
          enforceRecipientLimit: true, // Enforce limit for specific recipients
        },
        session,
      );

      return createdEmail;
    });

    // Add email to queue for processing (non-blocking, sequential processing)
    emailProcessor.queueEmail(email._id);

    return res.status(200).json({
      success: true,
      message: `Email created successfully for ${recipientsArray.length} recipient(s) and will be processed shortly`,
    });
  } catch (error) {
    // logger.logException(error, 'Error creating email');
    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      message: error.message || 'Error creating email',
    };
    // Include invalidRecipients if present (from service validation)
    if (error.invalidRecipients) {
      response.invalidRecipients = error.invalidRecipients;
    }
    return res.status(statusCode).json(response);
  }
};

/**
 * Broadcast an announcement Email to all active HGN users and confirmed subscribers.
 * - Validates permissions and content; creates Email and batches in a transaction.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const sendEmailToSubscribers = async (req, res) => {
  // Requestor is required for permission check
  if (!req?.body?.requestor?.requestorId) {
    return res.status(401).json({ success: false, message: 'Missing requestor' });
  }

  // Permission check - sendEmailToSubscribers requires sendEmails
  const cansendEmailToSubscribers = await hasPermission(req.body.requestor, 'sendEmails');
  if (!cansendEmailToSubscribers) {
    return res
      .status(403)
      .json({ success: false, message: 'You are not authorized to send emails to subscribers.' });
  }

  try {
    const { subject, html } = req.body;

    // Validate that all template variables have been replaced (business rule)
    const unmatchedVariablesHtml = EmailTemplateService.getUnreplacedVariables(html);
    const unmatchedVariablesSubject = EmailTemplateService.getUnreplacedVariables(subject);
    const unmatchedVariables = [
      ...new Set([...unmatchedVariablesHtml, ...unmatchedVariablesSubject]),
    ];
    if (unmatchedVariables.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Email contains unreplaced template variables. Please ensure all variables are replaced before sending.',
        unmatchedVariables,
      });
    }

    // Get user
    const user = await userProfile.findById(req.body.requestor.requestorId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get ALL recipients (HGN users + email subscribers)
    const users = await userProfile.find({
      firstName: { $ne: '' },
      email: { $ne: null },
      isActive: true,
      emailSubscriptions: true,
    });

    const emailSubscribers = await EmailSubcriptionList.find({
      email: { $exists: true, $nin: [null, ''] },
      isConfirmed: true,
      emailSubscriptions: true,
    });

    const totalRecipients = users.length + emailSubscribers.length;
    if (totalRecipients === 0) {
      return res.status(400).json({ success: false, message: 'No recipients found' });
    }

    // Create email and batches in transaction (validation happens in services)
    const email = await withTransaction(async (session) => {
      // Create parent Email (validates subject, htmlContent, createdBy)
      const createdEmail = await EmailService.createEmail(
        {
          subject,
          htmlContent: html,
          createdBy: user._id,
        },
        session,
      );

      // Collect all recipients into single array
      const allRecipients = [
        ...users.map((hgnUser) => ({ email: hgnUser.email })),
        ...emailSubscribers.map((subscriber) => ({ email: subscriber.email })),
      ];

      // Create EmailBatch items with all recipients (validates recipients, counts, email format)
      // Skip recipient limit for broadcast to all subscribers
      await EmailBatchService.createEmailBatches(
        createdEmail._id,
        allRecipients,
        {
          emailType: EMAIL_CONFIG.EMAIL_TYPES.BCC,
          enforceRecipientLimit: false, // Skip limit for broadcast
        },
        session,
      );

      return createdEmail;
    });

    // Add email to queue for processing (non-blocking, sequential processing)
    emailProcessor.queueEmail(email._id);

    return res.status(200).json({
      success: true,
      message: `Broadcast email created successfully for ${totalRecipients} recipient(s) and will be processed shortly`,
    });
  } catch (error) {
    // logger.logException(error, 'Error creating broadcast email');
    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      message: error.message || 'Error creating broadcast email',
    };
    // Include invalidRecipients if present (from service validation)
    if (error.invalidRecipients) {
      response.invalidRecipients = error.invalidRecipients;
    }
    return res.status(statusCode).json(response);
  }
};

/**
 * Resend a previously created Email to a selected audience.
 * - Options: 'all' (users+subscribers), 'specific' (list), 'same' (original recipients).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const resendEmail = async (req, res) => {
  // Requestor is required for permission check
  if (!req?.body?.requestor?.requestorId) {
    return res.status(401).json({ success: false, message: 'Missing requestor' });
  }

  // Permission check - resending requires sendEmails permission
  const canSendEmail = await hasPermission(req.body.requestor, 'sendEmails');
  if (!canSendEmail) {
    return res
      .status(403)
      .json({ success: false, message: 'You are not authorized to resend emails.' });
  }

  try {
    const { emailId, recipientOption, specificRecipients } = req.body;

    // Validate emailId
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      return res.status(400).json({ success: false, message: 'Invalid emailId' });
    }

    // Get the original email (service throws error if not found)
    const originalEmail = await EmailService.getEmailById(emailId, null, true);

    // Validate recipient option
    if (!recipientOption) {
      return res.status(400).json({ success: false, message: 'Recipient option is required' });
    }

    const validRecipientOptions = ['all', 'specific', 'same'];
    if (!validRecipientOptions.includes(recipientOption)) {
      return res.status(400).json({
        success: false,
        message: `Invalid recipient option. Must be one of: ${validRecipientOptions.join(', ')}`,
      });
    }

    // Get requestor user
    const user = await userProfile.findById(req.body.requestor.requestorId);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Requestor not found' });
    }

    let allRecipients = [];

    // Determine recipients based on option
    if (recipientOption === 'all') {
      // Get ALL recipients (HGN users + email subscribers)
      const users = await userProfile.find({
        firstName: { $ne: '' },
        email: { $ne: null },
        isActive: true,
        emailSubscriptions: true,
      });

      const emailSubscribers = await EmailSubcriptionList.find({
        email: { $exists: true, $nin: [null, ''] },
        isConfirmed: true,
        emailSubscriptions: true,
      });

      allRecipients = [
        ...users.map((hgnUser) => ({ email: hgnUser.email })),
        ...emailSubscribers.map((subscriber) => ({ email: subscriber.email })),
      ];
    } else if (recipientOption === 'specific') {
      // Use provided specific recipients
      if (
        !specificRecipients ||
        !Array.isArray(specificRecipients) ||
        specificRecipients.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'specificRecipients array is required for specific option',
        });
      }

      // Normalize recipients (validation happens in service)
      const recipientsArray = normalizeRecipientsToArray(specificRecipients);
      allRecipients = recipientsArray.map((email) => ({ email }));
    } else if (recipientOption === 'same') {
      // Get recipients from original email's EmailBatch items
      const emailBatchItems = await EmailBatchService.getBatchesForEmail(emailId);
      if (!emailBatchItems || emailBatchItems.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'No recipients found in original email' });
      }

      // Extract all recipients from all EmailBatch items
      const batchRecipients = emailBatchItems
        .filter((batch) => batch.recipients && Array.isArray(batch.recipients))
        .flatMap((batch) => batch.recipients);
      allRecipients.push(...batchRecipients);

      // Deduplicate recipients by email
      const seenEmails = new Set();
      allRecipients = allRecipients.filter((recipient) => {
        if (!recipient || !recipient.email || seenEmails.has(recipient.email)) {
          return false;
        }
        seenEmails.add(recipient.email);
        return true;
      });
    }

    if (allRecipients.length === 0) {
      return res.status(400).json({ success: false, message: 'No recipients found' });
    }

    // Create email and batches in transaction
    const newEmail = await withTransaction(async (session) => {
      // Create new Email (copy) - validation happens in service
      const createdEmail = await EmailService.createEmail(
        {
          subject: originalEmail.subject,
          htmlContent: originalEmail.htmlContent,
          createdBy: user._id,
        },
        session,
      );

      // Create EmailBatch items
      // Enforce limit only for 'specific' recipient option, skip for 'all' and 'same' (broadcast scenarios)
      const shouldEnforceLimit = recipientOption === 'specific';
      await EmailBatchService.createEmailBatches(
        createdEmail._id,
        allRecipients,
        {
          emailType: EMAIL_CONFIG.EMAIL_TYPES.BCC,
          enforceRecipientLimit: shouldEnforceLimit,
        },
        session,
      );

      return createdEmail;
    });

    // Add email to queue for processing (non-blocking, sequential processing)
    emailProcessor.queueEmail(newEmail._id);

    return res.status(200).json({
      success: true,
      message: `Email created for resend successfully to ${allRecipients.length} recipient(s) and will be processed shortly`,
      data: {
        emailId: newEmail._id,
        recipientCount: allRecipients.length,
      },
    });
  } catch (error) {
    // logger.logException(error, 'Error resending email');
    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      message: error.message || 'Error resending email',
    };
    // Include invalidRecipients if present (from service validation)
    if (error.invalidRecipients) {
      response.invalidRecipients = error.invalidRecipients;
    }
    return res.status(statusCode).json(response);
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

    // Requestor is required for permission check
    if (!req?.body?.requestor?.requestorId) {
      return res.status(401).json({ success: false, message: 'Missing requestor' });
    }

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
      // logger.logInfo(`Email ${emailId} has no failed EmailBatch items to retry`);
      return res.status(200).json({
        success: true,
        message: 'No failed EmailBatch items to retry',
        data: {
          emailId: email._id,
          failedItemsRetried: 0,
        },
      });
    }

    // logger.logInfo(`Retrying ${failedItems.length} failed EmailBatch items: ${emailId}`);

    // Mark parent Email as PENDING for retry
    await EmailService.markEmailPending(emailId);

    // Reset each failed item to PENDING
    await Promise.all(
      failedItems.map(async (item) => {
        await EmailBatchService.resetEmailBatchForRetry(item._id);
      }),
    );

    // logger.logInfo(
    //   `Successfully reset Email ${emailId} and ${failedItems.length} failed EmailBatch items to PENDING for retry`,
    // );

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
    // logger.logException(error, 'Error retrying Email');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error retrying Email',
    });
  }
};

/**
 * Manually trigger processing of pending and stuck emails.
 * - Resets stuck emails (SENDING status) to PENDING
 * - Resets stuck batches (SENDING status) to PENDING
 * - Queues all PENDING emails for processing
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const processPendingAndStuckEmails = async (req, res) => {
  // Requestor is required for permission check
  if (!req?.body?.requestor?.requestorId) {
    return res.status(401).json({ success: false, message: 'Missing requestor' });
  }

  // Permission check - processing emails requires sendEmails permission
  const canProcessEmails = await hasPermission(req.body.requestor, 'sendEmails');
  if (!canProcessEmails) {
    return res
      .status(403)
      .json({ success: false, message: 'You are not authorized to process emails.' });
  }

  try {
    // logger.logInfo('Manual trigger: Starting processing of pending and stuck emails...');

    // Trigger the processor to handle pending and stuck emails
    await emailProcessor.processPendingAndStuckEmails();

    return res.status(200).json({
      success: true,
      message: 'Processing of pending and stuck emails triggered successfully',
    });
  } catch (error) {
    // logger.logException(error, 'Error triggering processing of pending and stuck emails');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error triggering processing of pending and stuck emails',
    });
  }
};

/**
 * Update the current user's emailSubscriptions preference.
 * - Normalizes email to lowercase for consistent lookups.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const updateEmailSubscriptions = async (req, res) => {
  try {
    if (!req?.body?.requestor?.email) {
      return res.status(401).json({ success: false, message: 'Missing requestor email' });
    }

    const { emailSubscriptions } = req.body;
    if (typeof emailSubscriptions !== 'boolean') {
      return res
        .status(400)
        .json({ success: false, message: 'emailSubscriptions must be a boolean value' });
    }

    const { email } = req.body.requestor;
    if (!isValidEmailAddress(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    // Normalize email for consistent lookup
    const normalizedEmail = email.trim().toLowerCase();

    const user = await userProfile.findOneAndUpdate(
      { email: normalizedEmail },
      { emailSubscriptions },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res
      .status(200)
      .json({ success: true, message: 'Email subscription updated successfully' });
  } catch (error) {
    // logger.logException(error, 'Error updating email subscriptions');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error updating email subscriptions',
    });
  }
};

/**
 * Add a non-HGN user's email to the subscription list and send confirmation.
 * - Rejects if already an HGN user or already subscribed.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const addNonHgnEmailSubscription = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Normalize and validate email
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmailAddress(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    // Check if email already exists (direct match since schema enforces lowercase)
    const existingSubscription = await EmailSubcriptionList.findOne({
      email: normalizedEmail,
    });

    if (existingSubscription) {
      return res.status(400).json({ success: false, message: 'Email already subscribed' });
    }

    // check if this email is already in the HGN user list
    const hgnUser = await userProfile.findOne({ email: normalizedEmail });
    if (hgnUser) {
      return res.status(400).json({
        success: false,
        message: 'Please use the HGN account profile page to subscribe to email updates.',
      });
    }

    // Save to DB immediately with confirmation pending
    const newEmailList = new EmailSubcriptionList({
      email: normalizedEmail,
      isConfirmed: false,
      emailSubscriptions: true,
    });
    await newEmailList.save();

    // Send confirmation email
    const payload = { email: normalizedEmail };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' }); // Fixed: was '360' (invalid)

    // Get frontend URL from request origin
    const getFrontendUrl = () => {
      // Try to get from request origin header first
      const origin = req.get('origin') || req.get('referer');
      if (origin) {
        try {
          const url = new URL(origin);
          return `${url.protocol}//${url.host}`;
        } catch (error) {
          // logger.logException(error, 'Error parsing request origin');
        }
      }
      // Fallback to config or construct from request
      if (config.FRONT_END_URL) {
        return config.FRONT_END_URL;
      }
      // Last resort: construct from request
      const protocol = req.protocol || 'https';
      const host = req.get('host');
      if (host) {
        return `${protocol}://${host}`;
      }
      return null;
    };

    const frontendUrl = getFrontendUrl();
    if (!frontendUrl) {
      // logger.logException(
      //   new Error('Unable to determine frontend URL from request'),
      //   'Configuration error',
      // );
      return res
        .status(500)
        .json({ success: false, message: 'Server Error. Please contact support.' });
    }

    const emailContent = `
      <p>Thank you for subscribing to our email updates!</p>
      <p><a href="${frontendUrl}/subscribe?token=${token}">Click here to confirm your email</a></p>
    `;

    try {
      await emailSender(
        normalizedEmail,
        'HGN Email Subscription',
        emailContent,
        null,
        null,
        null,
        null,
        { type: 'subscription_confirmation' },
      );
      return res.status(200).json({
        success: true,
        message: 'Email subscribed successfully. Please check your inbox to confirm.',
      });
    } catch (emailError) {
      // logger.logException(emailError, 'Error sending confirmation email');
      // Still return success since the subscription was saved to DB
      return res.status(200).json({
        success: true,
        message:
          'Email subscribed successfully. Confirmation email failed to send. Please contact support.',
      });
    }
  } catch (error) {
    // logger.logException(error, 'Error adding email subscription');
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already subscribed' });
    }
    return res.status(500).json({ success: false, message: 'Error adding email subscription' });
  }
};

/**
 * Confirm a non-HGN email subscription using a signed token.
 * - Only confirms existing unconfirmed subscriptions.
 * - Returns error if subscription doesn't exist (user must subscribe first).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const confirmNonHgnEmailSubscription = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    let payload = {};
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const { email } = payload;
    if (!email || !isValidEmailAddress(email)) {
      return res.status(400).json({ success: false, message: 'Invalid token payload' });
    }

    // Normalize email (schema enforces lowercase, but normalize here for consistency)
    const normalizedEmail = email.trim().toLowerCase();

    // Find existing subscription (direct match since schema enforces lowercase)
    const existingSubscription = await EmailSubcriptionList.findOne({
      email: normalizedEmail,
    });

    if (!existingSubscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found. Please subscribe first using the subscription form.',
      });
    }

    // If already confirmed, return success (idempotent)
    if (existingSubscription.isConfirmed) {
      return res.status(200).json({
        success: true,
        message: 'Email subscription already confirmed',
      });
    }

    // Update subscription to confirmed
    existingSubscription.isConfirmed = true;
    existingSubscription.confirmedAt = new Date();
    existingSubscription.emailSubscriptions = true;
    await existingSubscription.save();

    return res
      .status(200)
      .json({ success: true, message: 'Email subscription confirmed successfully' });
  } catch (error) {
    // logger.logException(error, 'Error confirming email subscription');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error confirming email subscription',
    });
  }
};

/**
 * Remove a non-HGN email from the subscription list (unsubscribe).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const removeNonHgnEmailSubscription = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmailAddress(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    // Try to delete the email subscription (direct match since schema enforces lowercase)
    const deletedEntry = await EmailSubcriptionList.findOneAndDelete({
      email: normalizedEmail,
    });

    // If not found, respond accordingly
    if (!deletedEntry) {
      return res
        .status(404)
        .json({ success: false, message: 'Email not found or already unsubscribed' });
    }

    return res.status(200).json({ success: true, message: 'Email unsubscribed successfully' });
  } catch (error) {
    // logger.logException(error, 'Error removing email subscription');
    return res.status(500).json({ success: false, message: 'Error removing email subscription' });
  }
};

module.exports = {
  sendEmail,
  sendEmailToSubscribers,
  resendEmail,
  updateEmailSubscriptions,
  addNonHgnEmailSubscription,
  removeNonHgnEmailSubscription,
  confirmNonHgnEmailSubscription,
  retryEmail,
  processPendingAndStuckEmails,
};
