// emailController.js
// const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const cheerio = require('cheerio');
const emailSender = require('../utilities/emailSender');
const EmailSubcriptionList = require('../models/emailSubcriptionList');
const userProfile = require('../models/userProfile');

const frontEndUrl = process.env.FRONT_END_URL || 'http://localhost:3000';
const jwtSecret = process.env.JWT_SECRET || 'EmailSecret';

const handleContentToAll = (htmlContent) =>
  `<!DOCTYPE html>
    <html>
      <head>
      <meta charset="utf-8">
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>`;

const handleContentToSubscriber = (htmlContent, email) =>
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
  console.log('extractImagesAndCreateAttachments');
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

  console.log('attachments', attachments);

  return {
    html: $.html(),
    attachments,
  };
}

const sendEmail = async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    console.log('to', to);

    emailSender(to, subject, html);
    return res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).send('Error sending email');
  }
};

const sendEmailToAll = async (req, res) => {
  try {
    const { subject, html } = req.body;
    // Check if subject and html are provided
    if (!subject || !html) {
      return res.status(400).send('Subject and HTML content are required');
    }

    const { html: updatedHtml, attachments } = extractImagesAndCreateAttachments(html);

    const users = await userProfile.find({
      firstName: 'Angela',
      email: { $ne: null },
      isActive: true,
      emailSubscriptions: true,
    });
    if (users.length === 0) {
      return res.status(404).send('No users found');
    }

    const to = users.map((user) => user.email).join(',');
    console.log('# sendEmailToAll to', to);
    if (!to) {
      throw new Error('No recipients defined');
    }

    const emailContentToAll = handleContentToAll(updatedHtml);

    emailSender(to, subject, emailContentToAll, attachments);

    const emailList = await EmailSubcriptionList.find({ email: { $ne: null } });
    emailList.forEach((emailObject) => {
      const { email } = emailObject;
      const emailContentToSubscriber = handleContentToSubscriber(html, email);
      emailSender(email, subject, emailContentToSubscriber);
    });
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
    const emailList = await EmailSubcriptionList.find({
      email: { $eq: email },
    });
    if (emailList.length > 0) {
      return res.status(400).send('Email already exists');
    }
    const payload = { email };

    const token = jwt.sign(payload, jwtSecret, {
      expiresIn: 360,
    });
    const emailContent = ` <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        <p>Thank you for subscribing to our email updates!</p>
        <p><a href="${frontEndUrl}/email-subscribe?token=${token}">Click here to confirm your email</a></p>
      </body>
      `;
    // console.log('email', email);
    emailSender(email, 'HGN Email Subscription', emailContent);
    return res.status(200).send('Email subsribed successfully');
  } catch (error) {
    console.error('Error updating email subscriptions:', error);
    res.status(500).send('Error updating email subscriptions');
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
    if (!email) {
      return res.status(400).send('Email is required');
    }
    await EmailSubcriptionList.findOneAndDelete({
      email: { $eq: email },
    });
    // console.log('delete', email);
    return res.status(200).send('Email unsubsribed successfully');
  } catch (error) {
    console.error('Error updating email subscriptions:', error);
    return res.status(500).send('Error updating email subscriptions');
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
