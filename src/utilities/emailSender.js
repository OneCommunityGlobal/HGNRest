const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const logger = require('../startup/logger');

const config = {
  email: process.env.REACT_APP_EMAIL,
  clientId: process.env.REACT_APP_EMAIL_CLIENT_ID,
  clientSecret: process.env.REACT_APP_EMAIL_CLIENT_SECRET,
  redirectUri: process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI,
  refreshToken: process.env.REACT_APP_EMAIL_REFRESH_TOKEN,
  batchSize: 90,
  concurrency: 1,
  rateLimitDelay: 2000,
};

const OAuth2Client = new google.auth.OAuth2(
  config.clientId,
  config.clientSecret,
  config.redirectUri,
);
OAuth2Client.setCredentials({ refresh_token: config.refreshToken });

// Create the email envelope (transport)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: config.email,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  },
});

const sendEmail = async (mailOptions) => {
  try {
    const { token } = await OAuth2Client.getAccessToken();

    if (!mailOptions.html || typeof mailOptions.html !== 'string') {
      throw new Error('Invalid email content');
    }

    mailOptions.auth = {
      user: config.email,
      refreshToken: config.refreshToken,
      accessToken: token,
    };
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

const queue = [];
let isProcessing = false;

const processQueue = async () => {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  const processBatch = async () => {
    if (queue.length === 0) {
      isProcessing = false;
      return;
    }

    const batch = queue.shift();
    try {
      await sendEmail(batch);
    } catch (error) {
      logger.logException(error, 'Failed to send email batch');
    }
    setTimeout(processBatch, config.rateLimitDelay);
  };

  const concurrentProcesses = Array(config.concurrency).fill().map(processBatch);

  try {
    await Promise.all(concurrentProcesses);
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
) => {
  if (!process.env.sendEmail) return;

  return new Promise((resolve, reject) => {
    const recipientsArray = Array.isArray(recipients) ? recipients : [recipients];
    
    if (!message || typeof message !== 'string') {
      reject(new Error('Invalid email content'));
      return;
    }

    for (let i = 0; i < recipientsArray.length; i += config.batchSize) {
      const batchRecipients = recipientsArray.slice(i, i + config.batchSize);
      queue.push({
        from: config.email,
        to: batchRecipients ? batchRecipients.join(',') : [],
        bcc: emailBccs ? emailBccs.join(',') : [],
        subject,
        html: message,
        attachments,
        cc,
        replyTo,
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

module.exports = emailSender;
