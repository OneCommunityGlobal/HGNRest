// emailController.js
const jwt = require('jsonwebtoken');
const cheerio = require('cheerio');
const emailSender = require('../utilities/emailSender');
const { hasPermission } = require('../utilities/permissions');
const EmailSubcriptionList = require('../models/emailSubcriptionList');
const userProfile = require('../models/userProfile');

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
          <p> Thank you for subscribing to our email updates!</p>
          <p> If you would like to unsubscribe, please click <a href="${frontEndUrl}/email-unsubscribe?email=${email}">here</a></p>
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
    const { to, subject, html } = req.body;
    // Validate required fields
    if (!subject || !html || !to) {
      const missingFields = [];
      if (!subject) missingFields.push('Subject');
      if (!html) missingFields.push('HTML content');
      if (!to) missingFields.push('Recipient email');
      return res
        .status(400)
        .send(`${missingFields.join(' and ')} ${missingFields.length > 1 ? 'are' : 'is'} required`);
    }

    await emailSender(to, subject, html)
      .then(() => {
        res.status(200).send(`Email sent successfully to ${to}`);
      })
      .catch(() => {
        res.status(500).send('Error sending email');
      });
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
    const { subject, html } = req.body;
    if (!subject || !html) {
      return res.status(400).send('Subject and HTML content are required');
    }

    const { html: processedHtml, attachments } = extractImagesAndCreateAttachments(html);

    const users = await userProfile.find({
      firstName: '',
      email: { $ne: null },
      isActive: true,
      emailSubscriptions: true,
    });
    if (users.length === 0) {
      return res.status(404).send('No users found');
    }

    const recipientEmails = users.map((user) => user.email);
    console.log('# sendEmailToAll to', recipientEmails.join(','));
    if (recipientEmails.length === 0) {
      throw new Error('No recipients defined');
    }
    const emailContentToOCmembers = handleContentToOC(processedHtml);
    await Promise.all(
      recipientEmails.map((email) =>
        emailSender(email, subject, emailContentToOCmembers, attachments),
      ),
    );
    const emailSubscribers = await EmailSubcriptionList.find({ email: { $exists: true, $ne: '' } });
    console.log('# sendEmailToAll emailSubscribers', emailSubscribers.length);
    await Promise.all(
      emailSubscribers.map(({ email }) => {
        const emailContentToNonOCmembers = handleContentToNonOC(processedHtml, email);
        return emailSender(email, subject, emailContentToNonOCmembers, attachments);
      }),
    );
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

    // Save to DB immediately
    const newEmailList = new EmailSubcriptionList({ email });
    await newEmailList.save();

    // Optional: Still send confirmation email
    const payload = { email };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: 360 });
    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body>
          <p>Thank you for subscribing to our email updates!</p>
          <p><a href="${frontEndUrl}/email-subscribe?token=${token}">Click here to confirm your email</a></p>
        </body>
      </html>
    `;

    emailSender(email, 'HGN Email Subscription', emailContent);
    return res.status(200).send('Email subscribed successfully');
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
      const newEmailList = new EmailSubcriptionList({ email });
      await newEmailList.save();
    } catch (error) {
      if (error.code === 11000) {
        return res.status(200).send('Email already exists');
      }
    }
    // console.log('email', email);
    return res.status(200).send('Email subsribed successfully');
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

    // Try to delete the email
    const deletedEntry = await EmailSubcriptionList.findOneAndDelete({
      email: { $eq: email },
    });

    // If not found, respond accordingly
    if (!deletedEntry) {
      return res.status(404).send('Email not found or already unsubscribed');
    }

    return res.status(200).send('Email unsubscribed successfully');
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
