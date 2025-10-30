// emailController.js
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const emailSender = require('../utilities/emailSender');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');
const {
  isValidEmailAddress,
  normalizeRecipientsToArray,
  ensureHtmlWithinLimit,
  validateHtmlMedia,
} = require('../utilities/emailValidators');
const EmailSubcriptionList = require('../models/emailSubcriptionList');
const userProfile = require('../models/userProfile');
const EmailBatchService = require('../services/emailBatchService');
const EmailService = require('../services/emailService');
const EmailBatchAuditService = require('../services/emailBatchAuditService');
const { hasPermission } = require('../utilities/permissions');
const config = require('../config');
const logger = require('../startup/logger');

const jwtSecret = process.env.JWT_SECRET;

const sendEmail = async (req, res) => {
  // Requestor is required for permission check and audit trail
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

    const missingFields = [];
    if (!subject) missingFields.push('Subject');
    if (!html) missingFields.push('HTML content');
    if (!to) missingFields.push('Recipient email');
    if (missingFields.length) {
      return res.status(400).json({
        success: false,
        message: `${missingFields.join(' and ')} ${missingFields.length > 1 ? 'are' : 'is'} required`,
      });
    }

    // Validate HTML content size
    if (!ensureHtmlWithinLimit(html)) {
      return res.status(413).json({
        success: false,
        message: `HTML content exceeds ${EMAIL_JOB_CONFIG.LIMITS.MAX_HTML_BYTES / (1024 * 1024)}MB limit`,
      });
    }

    // Validate subject length against config
    if (subject && subject.length > EMAIL_JOB_CONFIG.LIMITS.SUBJECT_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Subject cannot exceed ${EMAIL_JOB_CONFIG.LIMITS.SUBJECT_MAX_LENGTH} characters`,
      });
    }

    // Validate HTML does not contain base64-encoded media
    const mediaValidation = validateHtmlMedia(html);
    if (!mediaValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'HTML contains embedded media files. Only URLs are allowed for media.',
        errors: mediaValidation.errors,
      });
    }

    // Validate that all template variables have been replaced
    const templateVariableRegex = /\{\{(\w+)\}\}/g;
    const unmatchedVariables = [];
    let match = templateVariableRegex.exec(html);
    while (match !== null) {
      if (!unmatchedVariables.includes(match[1])) {
        unmatchedVariables.push(match[1]);
      }
      match = templateVariableRegex.exec(html);
    }
    // Check subject as well
    if (subject) {
      templateVariableRegex.lastIndex = 0;
      match = templateVariableRegex.exec(subject);
      while (match !== null) {
        if (!unmatchedVariables.includes(match[1])) {
          unmatchedVariables.push(match[1]);
        }
        match = templateVariableRegex.exec(subject);
      }
    }
    if (unmatchedVariables.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Email contains unreplaced template variables. Please ensure all variables are replaced before sending.',
        errors: {
          unmatchedVariables: `Found unreplaced variables: ${unmatchedVariables.join(', ')}`,
        },
      });
    }

    try {
      // Normalize, dedupe, and validate recipients FIRST
      const recipientsArray = normalizeRecipientsToArray(to);
      if (recipientsArray.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: 'At least one recipient email is required' });
      }
      if (recipientsArray.length > EMAIL_JOB_CONFIG.LIMITS.MAX_RECIPIENTS_PER_REQUEST) {
        return res.status(400).json({
          success: false,
          message: `A maximum of ${EMAIL_JOB_CONFIG.LIMITS.MAX_RECIPIENTS_PER_REQUEST} recipients are allowed per request`,
        });
      }
      const invalidRecipients = recipientsArray.filter((e) => !isValidEmailAddress(e));
      if (invalidRecipients.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more recipient emails are invalid',
          invalidRecipients,
        });
      }

      // Always use batch system for tracking and progress
      const user = await userProfile.findById(req.body.requestor.requestorId);
      if (!user) {
        return res.status(400).json({ success: false, message: 'Requestor not found' });
      }

      // Start MongoDB transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Create parent Email within transaction
        const email = await EmailService.createEmail(
          {
            subject,
            htmlContent: html,
            createdBy: user._id,
          },
          session,
        );

        // Create EmailBatch items with all recipients (chunked automatically) within transaction
        // Always use BCC for all recipients (sender goes in 'to' field)
        const recipientObjects = recipientsArray.map((emailAddr) => ({ email: emailAddr }));
        const inserted = await EmailBatchService.createEmailBatches(
          email._id,
          recipientObjects,
          {
            emailType: EMAIL_JOB_CONFIG.EMAIL_TYPES.BCC,
          },
          session,
        );

        // Commit transaction
        await session.commitTransaction();

        // Audit logging after successful commit (outside transaction to avoid failures)
        try {
          await EmailBatchAuditService.logEmailQueued(
            email._id,
            {
              subject: email.subject,
            },
            user._id,
          );

          // Audit each batch creation
          await Promise.all(
            inserted.map(async (item) => {
              await EmailBatchAuditService.logEmailBatchQueued(
                email._id,
                item._id,
                {
                  recipientCount: item.recipients?.length || 0,
                  emailType: item.emailType,
                  recipients: item.recipients?.map((r) => r.email) || [],
                  emailBatchId: item._id.toString(),
                },
                user._id,
              );
            }),
          );
        } catch (auditErr) {
          logger.logException(auditErr, 'Audit failure after successful email creation');
          // Don't fail the request if audit fails
        }

        session.endSession();

        return res.status(200).json({
          success: true,
          message: `Email created successfully for ${recipientsArray.length} recipient(s)`,
        });
      } catch (emailError) {
        // Abort transaction on error
        await session.abortTransaction();
        session.endSession();
        throw emailError;
      }
    } catch (emailError) {
      logger.logException(emailError, 'Error creating email');
      return res.status(500).json({ success: false, message: 'Error creating email' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error creating email' });
  }
};

const sendEmailToSubscribers = async (req, res) => {
  // Requestor is required for permission check and audit trail
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
    if (!subject || !html) {
      return res
        .status(400)
        .json({ success: false, message: 'Subject and HTML content are required' });
    }

    if (!ensureHtmlWithinLimit(html)) {
      return res.status(413).json({
        success: false,
        message: `HTML content exceeds ${EMAIL_JOB_CONFIG.LIMITS.MAX_HTML_BYTES / (1024 * 1024)}MB limit`,
      });
    }

    // Validate HTML does not contain base64-encoded media
    const mediaValidation = validateHtmlMedia(html);
    if (!mediaValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'HTML contains embedded media files. Only URLs are allowed for media.',
        errors: mediaValidation.errors,
      });
    }

    // Validate that all template variables have been replaced
    const templateVariableRegex = /\{\{(\w+)\}\}/g;
    const unmatchedVariables = [];
    let match = templateVariableRegex.exec(html);
    while (match !== null) {
      if (!unmatchedVariables.includes(match[1])) {
        unmatchedVariables.push(match[1]);
      }
      match = templateVariableRegex.exec(html);
    }
    // Check subject as well
    if (subject) {
      templateVariableRegex.lastIndex = 0;
      match = templateVariableRegex.exec(subject);
      while (match !== null) {
        if (!unmatchedVariables.includes(match[1])) {
          unmatchedVariables.push(match[1]);
        }
        match = templateVariableRegex.exec(subject);
      }
    }
    if (unmatchedVariables.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          'Email contains unreplaced template variables. Please ensure all variables are replaced before sending.',
        errors: {
          unmatchedVariables: `Found unreplaced variables: ${unmatchedVariables.join(', ')}`,
        },
      });
    }

    // Always use new batch system for broadcast emails
    const user = await userProfile.findById(req.body.requestor.requestorId);
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Get ALL recipients FIRST (HGN users + email subscribers)
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

    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create parent Email within transaction
      const email = await EmailService.createEmail(
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

      // Create EmailBatch items with all recipients (chunked automatically) within transaction
      // Use BCC for broadcast emails to hide recipient list from each other
      const inserted = await EmailBatchService.createEmailBatches(
        email._id,
        allRecipients,
        {
          emailType: EMAIL_JOB_CONFIG.EMAIL_TYPES.BCC,
        },
        session,
      );

      // Commit transaction
      await session.commitTransaction();

      // Audit logging after successful commit (outside transaction to avoid failures)
      try {
        await EmailBatchAuditService.logEmailQueued(
          email._id,
          {
            subject: email.subject,
          },
          user._id,
        );

        // Audit each batch creation
        await Promise.all(
          inserted.map(async (item) => {
            await EmailBatchAuditService.logEmailBatchQueued(
              email._id,
              item._id,
              {
                recipientCount: item.recipients?.length || 0,
                emailType: item.emailType,
                recipients: item.recipients?.map((r) => r.email) || [],
                emailBatchId: item._id.toString(),
              },
              user._id,
            );
          }),
        );
      } catch (auditErr) {
        logger.logException(auditErr, 'Audit failure after successful broadcast email creation');
        // Don't fail the request if audit fails
      }

      session.endSession();

      return res.status(200).json({
        success: true,
        message: `Broadcast email created successfully for ${totalRecipients} recipient(s)`,
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    logger.logException(error, 'Error creating broadcast email');
    return res.status(500).json({ success: false, message: 'Error creating broadcast email' });
  }
};

const resendEmail = async (req, res) => {
  // Requestor is required for permission check and audit trail
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

    // Get the original email
    const originalEmail = await EmailService.getEmailById(emailId);
    if (!originalEmail) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }

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

      // Normalize and validate recipients
      const recipientsArray = normalizeRecipientsToArray(specificRecipients);
      const invalidRecipients = recipientsArray.filter((e) => !isValidEmailAddress(e));
      if (invalidRecipients.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more recipient emails are invalid',
          invalidRecipients,
        });
      }

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

    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create new Email (copy) within transaction
      const newEmail = await EmailService.createEmail(
        {
          subject: originalEmail.subject,
          htmlContent: originalEmail.htmlContent,
          createdBy: user._id,
        },
        session,
      );

      // Create EmailBatch items within transaction
      // Always use BCC for all recipients (sender goes in 'to' field)
      const inserted = await EmailBatchService.createEmailBatches(
        newEmail._id,
        allRecipients,
        {
          emailType: EMAIL_JOB_CONFIG.EMAIL_TYPES.BCC,
        },
        session,
      );

      // Commit transaction
      await session.commitTransaction();

      // Audit logging after successful commit (outside transaction)
      try {
        await EmailBatchAuditService.logEmailQueued(
          newEmail._id,
          {
            subject: newEmail.subject,
            resendFrom: emailId.toString(),
            recipientOption,
          },
          user._id,
        );

        // Audit each batch creation
        await Promise.all(
          inserted.map(async (item) => {
            await EmailBatchAuditService.logEmailBatchQueued(
              newEmail._id,
              item._id,
              {
                recipientCount: item.recipients?.length || 0,
                emailType: item.emailType,
                recipients: item.recipients?.map((r) => r.email) || [],
                emailBatchId: item._id.toString(),
              },
              user._id,
            );
          }),
        );
      } catch (auditErr) {
        logger.logException(auditErr, 'Audit failure after successful email resend');
      }

      session.endSession();

      return res.status(200).json({
        success: true,
        message: `Email queued for resend successfully to ${allRecipients.length} recipient(s)`,
        data: {
          emailId: newEmail._id,
          recipientCount: allRecipients.length,
        },
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    logger.logException(error, 'Error resending email');
    return res.status(500).json({ success: false, message: 'Error resending email' });
  }
};

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
    return res.status(500).json({ success: false, message: 'Error updating email subscriptions' });
  }
};

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
      return res
        .status(400)
        .json({
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
      console.error('FRONT_END_URL is not configured');
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
