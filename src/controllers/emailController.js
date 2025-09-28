// emailController.js
const jwt = require('jsonwebtoken');
const cheerio = require('cheerio');
const emailSender = require('../utilities/emailSender');
const { hasPermission } = require('../utilities/permissions');
const EmailSubcriptionList = require('../models/emailSubcriptionList');
const userProfile = require('../models/userProfile');
const EmailBatchService = require('../services/emailBatchService');
const emailBatchProcessor = require('../services/emailBatchProcessor');

const frontEndUrl = process.env.FRONT_END_URL || 'http://localhost:3000';
const jwtSecret = process.env.JWT_SECRET || 'EmailSecret';

const handleContentToOC = (htmlContent) =>
  `<!DOCTYPE html>
    <html>
      <head>
      <meta charset="utf-8">
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>`;

const handleContentToNonOC = (htmlContent, email) =>
  `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body>
          ${htmlContent}
          <p style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
            If you would like to unsubscribe from these emails, please click 
            <a href="${frontEndUrl}/email-unsubscribe?email=${email}" style="color: #0066cc; text-decoration: underline;">here</a>
          </p>
        </body>
      </html>`;

function extractImagesAndCreateAttachments(html) {
  const $ = cheerio.load(html);
  const attachments = [];

  $('img').each((i, img) => {
    const src = $(img).attr('src');
    if (src.startsWith('data:image')) {
      const base64Data = src.split(',')[1];
      const _cid = `image-${i}`;
      attachments.push({
        filename: `image-${i}.png`,
        content: Buffer.from(base64Data, 'base64'),
        cid: _cid,
      });
      $(img).attr('src', `cid:${_cid}`);
    }
  });
  return {
    html: $.html(),
    attachments,
  };
}

const sendEmail = async (req, res) => {
  const canSendEmail = await hasPermission(req.body.requestor, 'sendEmails');
  if (!canSendEmail) {
    res.status(403).send('You are not authorized to send emails.');
    return;
  }
  try {
    const { to, subject, html, useBatch = true } = req.body;
    if (!subject || !html || !to) {
      const missingFields = [];
      if (!subject) missingFields.push('Subject');
      if (!html) missingFields.push('HTML content');
      if (!to) missingFields.push('Recipient email');
      return res
        .status(400)
        .send(`${missingFields.join(' and ')} ${missingFields.length > 1 ? 'are' : 'is'} required`);
    }

    const { html: processedHtml, attachments } = extractImagesAndCreateAttachments(html);

    try {
      // Convert to array if it's a string
      const recipientsArray = Array.isArray(to) ? to : [to];

      if (useBatch) {
        // Use new batch system for better tracking and user experience
        const user = await userProfile.findById(req.body.requestor.requestorId);
        if (!user) {
          return res.status(400).send('User not found');
        }

        // Create batch for this email send (this already adds recipients internally)
        console.log('📧 Creating batch for email send...');
        const batch = await EmailBatchService.createSingleSendBatch(
          {
            to: recipientsArray,
            subject,
            html: processedHtml,
            attachments,
          },
          user,
        );

        console.log('✅ Batch created with recipients:', batch.batchId);

        // Start processing the batch
        console.log('🚀 Starting batch processing...');
        emailBatchProcessor.processBatch(batch.batchId).catch((error) => {
          console.error('❌ Error processing batch:', error);
        });

        // Get dynamic counts for response
        const counts = await batch.getEmailCounts();

        res.status(200).json({
          success: true,
          message: `Email batch created successfully for ${recipientsArray.length} recipient(s)`,
          data: {
            batchId: batch.batchId,
            status: batch.status,
            subject: batch.subject,
            recipients: recipientsArray,
            ...counts,
            createdAt: batch.createdAt,
          },
        });
      } else {
        // Legacy direct sending (fallback)
        if (recipientsArray.length === 1) {
          // Single recipient - use TO field
          await emailSender(to, subject, processedHtml, attachments);
        } else {
          // Multiple recipients - use BCC to hide recipient list
          // Send to self (sender) as primary recipient, then BCC all actual recipients
          const senderEmail = req.body.fromEmail || 'updates@onecommunityglobal.org';
          await emailSender(
            senderEmail,
            subject,
            processedHtml,
            attachments,
            null,
            null,
            recipientsArray,
          );
        }

        res.status(200).send(`Email sent successfully to ${recipientsArray.length} recipient(s)`);
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      res.status(500).send('Error sending email');
    }
  } catch (error) {
    return res.status(500).send('Error sending email');
  }
};

const sendEmailToAll = async (req, res) => {
  const canSendEmailToAll = await hasPermission(req.body.requestor, 'sendEmailToAll');
  if (!canSendEmailToAll) {
    res.status(403).send('You are not authorized to send emails to all.');
    return;
  }
  try {
    const { subject, html, useBatch = true } = req.body;
    if (!subject || !html) {
      return res.status(400).send('Subject and HTML content are required');
    }

    const { html: processedHtml, attachments } = extractImagesAndCreateAttachments(html);

    if (useBatch) {
      // Use new batch system for broadcast emails
      const user = await userProfile.findById(req.body.requestor.requestorId);
      if (!user) {
        return res.status(400).send('User not found');
      }

      // Get all recipients
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
      console.log('# sendEmailToAll total recipients:', totalRecipients);

      if (totalRecipients === 0) {
        return res.status(400).send('No recipients found');
      }

      // Create batch for broadcast
      const batch = await EmailBatchService.createBatch({
        name: `Broadcast - ${subject}`,
        description: `Broadcast email to all subscribers (${totalRecipients} recipients)`,
        createdBy: user._id,
        createdByName: `${user.firstName} ${user.lastName}`,
        createdByEmail: user.email,
        subject,
        htmlContent: processedHtml,
        attachments,
        metadata: {
          type: 'broadcast',
          originalRequest: req.body,
          priority: 'NORMAL',
        },
      });

      // Add HGN users
      if (users.length > 0) {
        const hgnRecipients = users.map((hgnUser) => ({
          email: hgnUser.email,
          name: `${hgnUser.firstName} ${hgnUser.lastName}`,
          personalizedContent: handleContentToOC(processedHtml),
          emailType: 'TO',
          tags: ['hgn_user'],
        }));
        await EmailBatchService.addRecipients(batch.batchId, hgnRecipients);
      }

      // Add email subscribers
      if (emailSubscribers.length > 0) {
        const subscriberRecipients = emailSubscribers.map((subscriber) => ({
          email: subscriber.email,
          personalizedContent: handleContentToNonOC(processedHtml, subscriber.email),
          emailType: 'TO',
          tags: ['email_subscriber'],
        }));
        await EmailBatchService.addRecipients(batch.batchId, subscriberRecipients);
      }

      // Start processing the batch
      emailBatchProcessor.processBatch(batch.batchId).catch((error) => {
        console.error('Error processing broadcast batch:', error);
      });

      // Get dynamic counts for response
      const counts = await batch.getEmailCounts();

      return res.status(200).json({
        success: true,
        message: `Broadcast email batch created successfully for ${totalRecipients} recipient(s)`,
        data: {
          batchId: batch.batchId,
          status: batch.status,
          subject: batch.subject,
          recipients: {
            hgnUsers: users.length,
            emailSubscribers: emailSubscribers.length,
            total: totalRecipients,
          },
          ...counts,
          createdBy: batch.createdBy,
          createdAt: batch.createdAt,
          estimatedCompletion: new Date(Date.now() + totalRecipients * 2000), // 2 seconds per email estimate
        },
      });
    }
    // Legacy direct sending (fallback)
    // HGN Users logic
    const users = await userProfile.find({
      firstName: { $ne: '' },
      email: { $ne: null },
      isActive: true,
      emailSubscriptions: true,
    });

    if (users.length > 0) {
      const recipientEmails = users.map((user) => user.email);
      console.log('# sendEmailToAll to HGN users:', recipientEmails.length);
      const emailContentToOCmembers = handleContentToOC(processedHtml);
      await Promise.all(
        recipientEmails.map((email) =>
          emailSender(email, subject, emailContentToOCmembers, attachments),
        ),
      );
    } else {
      console.log('# sendEmailToAll: No HGN users found with email subscriptions');
    }
    const emailSubscribers = await EmailSubcriptionList.find({
      email: { $exists: true, $ne: '' },
      isConfirmed: true,
      emailSubscriptions: true,
    });
    console.log('# sendEmailToAll emailSubscribers', emailSubscribers.length);

    if (emailSubscribers.length > 0) {
      await Promise.all(
        emailSubscribers.map(({ email }) => {
          const emailContentToNonOCmembers = handleContentToNonOC(processedHtml, email);
          return emailSender(email, subject, emailContentToNonOCmembers, attachments);
        }),
      );
    } else {
      console.log('# sendEmailToAll: No confirmed email subscribers found');
    }
    return res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).send('Error sending email');
  }
};

const updateEmailSubscriptions = async (req, res) => {
  try {
    const { emailSubscriptions } = req.body;
    const { email } = req.body.requestor;
    const user = await userProfile.findOneAndUpdate(
      { email },
      { emailSubscriptions },
      { new: true },
    );
    return res.status(200).send(user);
  } catch (error) {
    console.error('Error updating email subscriptions:', error);
    return res.status(500).send('Error updating email subscriptions');
  }
};

const addNonHgnEmailSubscription = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send('Email is required');
    }

    const emailList = await EmailSubcriptionList.find({ email: { $eq: email } });
    if (emailList.length > 0) {
      return res.status(400).send('Email already exists');
    }

    // Save to DB immediately with confirmation pending
    const newEmailList = new EmailSubcriptionList({
      email,
      isConfirmed: false,
      emailSubscriptions: true,
    });
    await newEmailList.save();

    // Optional: Still send confirmation email
    const payload = { email };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '360' });
    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body>
          <p>Thank you for subscribing to our email updates!</p>
          <p><a href="${frontEndUrl}/subscribe?token=${token}">Click here to confirm your email</a></p>
        </body>
      </html>
    `;

    try {
      await emailSender(email, 'HGN Email Subscription', emailContent);
      return res.status(200).send('Email subscribed successfully');
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Still return success since the subscription was saved to DB
      return res
        .status(200)
        .send('Email subscribed successfully (confirmation email failed to send)');
    }
  } catch (error) {
    console.error('Error adding email subscription:', error);
    res.status(500).send('Error adding email subscription');
  }
};

const confirmNonHgnEmailSubscription = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).send('Invalid token');
    }
    let payload = {};
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch (err) {
      // console.log(err);
      return res.status(401).json({ errors: [{ msg: 'Token is not valid' }] });
    }
    const { email } = payload;
    if (!email) {
      return res.status(400).send('Invalid token');
    }
    try {
      // Update existing subscription to confirmed, or create new one
      const existingSubscription = await EmailSubcriptionList.findOne({ email });
      if (existingSubscription) {
        existingSubscription.isConfirmed = true;
        existingSubscription.confirmedAt = new Date();
        existingSubscription.emailSubscriptions = true;
        await existingSubscription.save();
      } else {
        const newEmailList = new EmailSubcriptionList({
          email,
          isConfirmed: true,
          confirmedAt: new Date(),
          emailSubscriptions: true,
        });
        await newEmailList.save();
      }
    } catch (error) {
      if (error.code === 11000) {
        return res.status(200).send('Email already exists');
      }
    }
    // console.log('email', email);
    return res.status(200).send('Email subscribed successfully');
  } catch (error) {
    console.error('Error updating email subscriptions:', error);
    return res.status(500).send('Error updating email subscriptions');
  }
};

const removeNonHgnEmailSubscription = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).send('Email is required');
    }

    // Try to delete the email subscription completely
    const deletedEntry = await EmailSubcriptionList.findOneAndDelete({
      email: { $eq: email },
    });

    // If not found, respond accordingly
    if (!deletedEntry) {
      return res.status(404).send('Email not found or already unsubscribed');
    }

    return res.status(200).send('Email unsubscribed and removed from subscription list');
  } catch (error) {
    return res.status(500).send('Server error while unsubscribing');
  }
};

module.exports = {
  sendEmail,
  sendEmailToAll,
  updateEmailSubscriptions,
  addNonHgnEmailSubscription,
  removeNonHgnEmailSubscription,
  confirmNonHgnEmailSubscription,
};
