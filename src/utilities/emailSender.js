// src/utilities/emailSender.js
const nodemailer = require('nodemailer');
// const { google } = require('googleapis');
const logger = require('../startup/logger');
const EmailHistory = require('../models/emailHistory');

const config = {
  email: process.env.REACT_APP_EMAIL,
  clientId: process.env.REACT_APP_EMAIL_CLIENT_ID,
  clientSecret: process.env.REACT_APP_EMAIL_CLIENT_SECRET,
  redirectUri: process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI,
  refreshToken: process.env.REACT_APP_EMAIL_REFRESH_TOKEN,
  batchSize: 50,
  concurrency: 3,
  rateLimitDelay: 1000,
};

// Check if email sending is enabled
const sendEmailEnabled = process.env.sendEmail === 'true';
if (!sendEmailEnabled) console.log('Email sending is DISABLED via env variable.');
// const OAuth2Client = new google.auth.OAuth2(
//   config.clientId,
//   config.clientSecret,
//   config.redirectUri,
// );
// OAuth2Client.setCredentials({ refresh_token: config.refreshToken });

// Create the email envelope (transport)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  // auth: {
  //   type: 'OAuth2',
  //   user: config.email,
  //   clientId: config.clientId,
  //   clientSecret: config.clientSecret,
  // },
  // auth: {
  //   user: process.env.REACT_APP_EMAIL,
  //   pass: process.env.EMAIL_APP_PASSWORD,
  // },
  host: 'smtp.gmail.com',
  // port: parseInt(process.env.SMTPPort, 10),
  port: 587,
  secure: false, // true for port 465
  auth: {
    user: process.env.TEST_EMAIL,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// Queue system for batch sending
const queue = [];
let isProcessing = false;

const sendEmail = async (mailOptions) => {
  try {
    // const accessTokenResp = await OAuth2Client.getAccessToken();
    // const token = typeof accessTokenResp === 'object' ? accessTokenResp?.token : accessTokenResp;

    // if (!token) {
    //   throw new Error('NO_OAUTH_ACCESS_TOKEN');
    // }

    // mailOptions.auth = {
    //   type: 'OAuth2', // include type
    //   user: config.email,
    //   clientId: config.clientId,
    //   clientSecret: config.clientSecret,
    //   refreshToken: config.refreshToken,
    //   accessToken: token,
    // };
    const result = await transporter.sendMail(mailOptions);
    if (process.env.NODE_ENV === 'local') {
      logger.logInfo(`Email sent: ${JSON.stringify(result)}`);
    }
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    logger.logException(error, `Error sending email: ${mailOptions.to}`);
    throw error;
  }
};

// const queue = [];
// let isProcessing = false;

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalize = (field) => {
  if (!field) {
    return [];
  }
  if (Array.isArray(field)) {
    return field;
  }
  return String(field).split(',');
};

const sendWithRetry = async (batch, retries = 3, baseDelay = 1000) => {
  const isBsAssignment = batch.meta?.type === 'blue_square_assignment';
  const key = `${batch.to}|${batch.subject}|${batch.meta?.type}`;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await sendEmail(batch);

      if (isBsAssignment) {
        await EmailHistory.findOneAndUpdate(
          { uniqueKey: key },
          {
            $set: {
              to: normalize(batch.to),
              cc: normalize(batch.cc),
              bcc: normalize(batch.bcc),
              subject: batch.subject,
              message: batch.html,
              status: 'SENT',
              updatedAt: new Date(),
            },
            $inc: { attempts: 1 },
          },
          { upsert: true, new: true },
        );
      }
      return true;
    } catch (err) {
      logger.logException(err, `Batch to ${batch.to || '(empty)'} attempt ${attempt}`);

      if (attempt === retries && isBsAssignment) {
        await EmailHistory.findOneAndUpdate(
          { uniqueKey: key },
          {
            $set: {
              to: normalize(batch.to),
              cc: normalize(batch.cc),
              bcc: normalize(batch.bcc),
              subject: batch.subject,
              message: batch.html,
              status: 'FAILED',
              updatedAt: new Date(),
            },
            $inc: { attempts: 1 },
          },
          { upsert: true, new: true },
        );
      }
    }

    if (attempt < retries) await sleep(baseDelay * attempt); // backoff
  }
  return false;
};

const worker = async () => {
  while (true) {
    // atomically pull next batch
    const batch = queue.shift();
    if (!batch) break; // queue drained for this worker

    await sendWithRetry(batch);
    if (config.rateLimitDelay) await sleep(config.rateLimitDelay); // pacing
  }
};

const processQueue = async () => {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  try {
    const n = Math.max(1, Number(config.concurrency) || 1);
    const workers = Array.from({ length: n }, () => worker());
    await Promise.all(workers); // drain-until-empty with N workers
  } finally {
    isProcessing = false;
  }
};

/**
 * Sends an email to one or more recipients, optionally including CC, BCC, attachments, and a reply-to address.
 * Emails are processed in batches and pushed to a queue for asynchronous sending.
 *
 * @param {string|string[]} recipients - The primary recipient(s) of the email. Can be a single email string or an array of email addresses.
 * @param {string} subject - The subject line of the email.
 * @param {string} message - The HTML body content of the email.
 * @param {Object[]|null} [attachments=null] - Optional array of attachment objects as expected by the email service.
 * @param {string[]|null} [cc=null] - Optional array of CC (carbon copy) email addresses.
 * @param {string|null} [replyTo=null] - Optional reply-to email address.
 * @param {string[]|null} [emailBccs=null] - Optional array of BCC (blind carbon copy) email addresses.
 * @param {Object} [opts={}] - Optional settings object.
 *
 * @returns {Promise<string>} A promise that resolves when the email queue has been processed successfully or rejects on error.
 *
 * @throws {Error} Will reject the promise if there is an error processing the email queue.
 *
 * @example
 * emailSender(
 *   ['user@example.com'],
 *   'Welcome!',
 *   '<p>Hello, welcome to our platform.</p>',
 *   null,
 *   ['cc@example.com'],
 *   'noreply@example.com',
 *   ['bcc@example.com']
 * )
 * .then(console.log)
 * .catch(console.error);
 */

const emailSender = (
  recipients,
  subject,
  message,
  attachments = null,
  cc = null,
  replyTo = null,
  emailBccs = null,
  opts = {},
) => {
  const type = opts.type || 'general';
  const isReset = type === 'password_reset';

  if (
    !process.env.sendEmail ||
    (String(process.env.sendEmail).toLowerCase() === 'false' && !isReset)
  ) {
    return Promise.resolve('EMAIL_SENDING_DISABLED');
  }

  return new Promise((resolve, reject) => {
    const recipientsArray = Array.isArray(recipients) ? recipients : [recipients];
    for (let i = 0; i < recipientsArray.length; i += config.batchSize) {
      const batchRecipients = recipientsArray.slice(i, i + config.batchSize);
      queue.push({
        // from: config.email,
        from: process.env.TEST_EMAIL,
        to: batchRecipients.length ? batchRecipients.join(',') : '',
        bcc: emailBccs ? emailBccs.join(',') : '',
        subject,
        html: message,
        attachments,
        cc,
        replyTo,
        meta: { type },
      });
    }

    setImmediate(async () => {
      try {
        await processQueue();
        resolve('Emails processed successfully');
      } catch (error) {
        reject(error);
      }
    });
  });
};

const sendSummaryNotification = async (recipientEmail, summary) => {
  const emailContent = `
  <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background-color: #a8d42e; text-align: center; padding: 20px;">
        <img src="https://onecommunityglobal.org/wp-content/uploads/2023/05/One-Community-Horizontal-Homepage-Header-980x140px-2.png" alt="One Community Logo" style="max-width: 400px; margin-bottom: 10px;" />
      </div>

      <!-- Message content -->
      <div style="padding: 30px;">
        <h2 style="color: #2d572c;">📬 You have unread messages today</h2>
        <ul style="font-size: 15px; padding-left: 20px; color: #333;">
          ${summary}
        </ul>
      </div>

      <!-- Footer -->
      <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 13px; color: #666;">
        © One Community — Built for the Highest Good of All
      </div>
    </div>
  </div>
`;

  try {
    await sendEmail({
      // from: config.email,
      from: process.env.TEST_EMAIL,
      to: recipientEmail,
      subject: `Unread Messages Summary`,
      html: emailContent,
    });
  } catch (error) {
    console.error(`❌ Failed to send summary email to ${recipientEmail}:`, error);
  }
};

emailSender.sendSummaryNotification = sendSummaryNotification;
module.exports = emailSender;
