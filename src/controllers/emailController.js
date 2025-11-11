// emailController.js
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const emailSender = require('../utilities/emailSender');
const { EMAIL_CONFIG } = require('../config/emailConfig');
const { isValidEmailAddress, normalizeRecipientsToArray } = require('../utilities/emailValidators');
const TemplateRenderingService = require('../services/announcements/emails/templateRenderingService');
const EmailSubcriptionList = require('../models/emailSubcriptionList');
const userProfile = require('../models/userProfile');
const EmailBatchService = require('../services/announcements/emails/emailBatchService');
const EmailService = require('../services/announcements/emails/emailService');
const emailProcessor = require('../services/announcements/emails/emailProcessor');
const { hasPermission } = require('../utilities/permissions');
const { withTransaction } = require('../utilities/transactionHelper');
const config = require('../config');
const logger = require('../startup/logger');

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
    const unmatchedVariablesHtml = TemplateRenderingService.getUnreplacedVariables(html);
    const unmatchedVariablesSubject = TemplateRenderingService.getUnreplacedVariables(subject);
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
      const recipientObjects = recipientsArray.map((emailAddr) => ({ email: emailAddr }));
      await EmailBatchService.createEmailBatches(
        createdEmail._id,
        recipientObjects,
        {
          emailType: EMAIL_CONFIG.EMAIL_TYPES.BCC,
        },
        session,
      );

      return createdEmail;
    });

    // Process email immediately (async, fire and forget)
    emailProcessor.processEmail(email._id).catch((processError) => {
      logger.logException(
        processError,
        `Error processing email ${email._id} immediately after creation`,
      );
    });

    return res.status(200).json({
      success: true,
      message: `Email created successfully for ${recipientsArray.length} recipient(s)`,
    });
  } catch (error) {
    logger.logException(error, 'Error creating email');
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
    const unmatchedVariablesHtml = TemplateRenderingService.getUnreplacedVariables(html);
    const unmatchedVariablesSubject = TemplateRenderingService.getUnreplacedVariables(subject);
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
      email: { $exists: true, $ne: '' },
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
      await EmailBatchService.createEmailBatches(
        createdEmail._id,
        allRecipients,
        {
          emailType: EMAIL_CONFIG.EMAIL_TYPES.BCC,
        },
        session,
      );

      return createdEmail;
    });

    // Process email immediately (async, fire and forget)
    emailProcessor.processEmail(email._id).catch((processError) => {
      logger.logException(
        processError,
        `Error processing broadcast email ${email._id} immediately after creation`,
      );
    });

    return res.status(200).json({
      success: true,
      message: `Broadcast email created successfully for ${totalRecipients} recipient(s)`,
    });
  } catch (error) {
    logger.logException(error, 'Error creating broadcast email');
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
        email: { $exists: true, $ne: '' },
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
      const emailBatchItems = await EmailBatchService.getEmailBatchesByEmailId(emailId);
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
      await EmailBatchService.createEmailBatches(
        createdEmail._id,
        allRecipients,
        {
          emailType: EMAIL_CONFIG.EMAIL_TYPES.BCC,
        },
        session,
      );

      return createdEmail;
    });

    // Process email immediately (async, fire and forget)
    emailProcessor.processEmail(newEmail._id).catch((processError) => {
      logger.logException(
        processError,
        `Error processing resent email ${newEmail._id} immediately after creation`,
      );
    });

    return res.status(200).json({
      success: true,
      message: `Email created for resend successfully to ${allRecipients.length} recipient(s)`,
      data: {
        emailId: newEmail._id,
        recipientCount: allRecipients.length,
      },
    });
  } catch (error) {
    logger.logException(error, 'Error resending email');
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
 * Update the current user's emailSubscriptions preference.
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

    const user = await userProfile.findOneAndUpdate(
      { email },
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
    logger.logException(error, 'Error updating email subscriptions');
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

    // Check if email already exists (case-insensitive)
    const existingSubscription = await EmailSubcriptionList.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') },
    });

    if (existingSubscription) {
      return res.status(400).json({ success: false, message: 'Email already subscribed' });
    }

    // check if this email is already in the HGN user list
    const hgnUser = await userProfile.findOne({ email: normalizedEmail });
    if (hgnUser) {
      return res.status(400).json({
        success: false,
        message:
          'You are already a member of the HGN community. Please use the HGN account profile page to subscribe to email updates.',
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

    if (!config.FRONT_END_URL) {
      logger.logException(new Error('FRONT_END_URL is not configured'), 'Configuration error');
      return res
        .status(500)
        .json({ success: false, message: 'Server configuration error. Please contact support.' });
    }

    const emailContent = `
      <p>Thank you for subscribing to our email updates!</p>
      <p><a href="${config.FRONT_END_URL}/subscribe?token=${token}">Click here to confirm your email</a></p>
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
      logger.logException(emailError, 'Error sending confirmation email');
      // Still return success since the subscription was saved to DB
      return res.status(200).json({
        success: true,
        message:
          'Email subscribed successfully. Confirmation email failed to send. Please contact support.',
      });
    }
  } catch (error) {
    logger.logException(error, 'Error adding email subscription');
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already subscribed' });
    }
    return res.status(500).json({ success: false, message: 'Error adding email subscription' });
  }
};

/**
 * Confirm a non-HGN email subscription using a signed token.
 * - Creates or updates the subscriber record as confirmed.
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

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    try {
      // Update existing subscription to confirmed, or create new one
      const existingSubscription = await EmailSubcriptionList.findOne({
        email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') },
      });

      if (existingSubscription) {
        existingSubscription.isConfirmed = true;
        existingSubscription.confirmedAt = new Date();
        existingSubscription.emailSubscriptions = true;
        await existingSubscription.save();
      } else {
        const newEmailList = new EmailSubcriptionList({
          email: normalizedEmail,
          isConfirmed: true,
          confirmedAt: new Date(),
          emailSubscriptions: true,
        });
        await newEmailList.save();
      }

      return res
        .status(200)
        .json({ success: true, message: 'Email subscription confirmed successfully' });
    } catch (error) {
      if (error.code === 11000) {
        // Race condition - email was already confirmed/subscribed
        return res
          .status(200)
          .json({ success: true, message: 'Email subscription already confirmed' });
      }
      throw error;
    }
  } catch (error) {
    logger.logException(error, 'Error confirming email subscription');
    return res.status(500).json({ success: false, message: 'Error confirming email subscription' });
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

    // Try to delete the email subscription (case-insensitive)
    const deletedEntry = await EmailSubcriptionList.findOneAndDelete({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') },
    });

    // If not found, respond accordingly
    if (!deletedEntry) {
      return res
        .status(404)
        .json({ success: false, message: 'Email not found or already unsubscribed' });
    }

    return res.status(200).json({ success: true, message: 'Email unsubscribed successfully' });
  } catch (error) {
    logger.logException(error, 'Error removing email subscription');
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
};
