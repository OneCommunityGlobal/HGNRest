const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const logger = require('../startup/logger');

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
    logger.logException(error, `Error sending email: ${mailOptions.to}`);
    throw error;
  }
};

const queue = [];
let isProcessing = false;

const { recipient, subject, message, cc, bcc, replyTo, acknowledgingReceipt, resolve, reject} = nextItem;

const processQueue = async () => {
  if (isProcessing || queue.length === 0) re

  isProcessing = true;
  console.log('Processing email queue...');

  const processBatch = async () => {
    if (queue.length === 0) {
      isProcessing = false;
      return;
    }

    const result = await transporter.sendMail(mailOptions);
      if (typeof acknowledgingReceipt === 'function') {
        acknowledgingReceipt(null, result);
      }
      // Prevent logging email in production
      // Why?
      // 1. Could create a security risk
      // 2. Could create heavy loads on the server if emails are sent to many people
      // 3. Contain limited useful info:
      //   result format : {"accepted":["emailAddr"],"rejected":[],"envelopeTime":209,"messageTime":566,"messageSize":317,"response":"250 2.0.0 OK  17***69 p11-2***322qvd.85 - gsmtp","envelope":{"from":"emailAddr", "to":"emailAddr"}}
      if (process.env.NODE_ENV === 'local') {
        logger.logInfo(`Email sent: ${JSON.stringify(result)}`);
      }
      resolve(result);
    } catch (error) {
      if (typeof acknowledgingReceipt === 'function') {
        acknowledgingReceipt(error, null);
      };
      logger.logException(
        error,
        `Error sending email: from ${CLIENT_EMAIL} to ${recipient} subject ${subject}`,
        `Extra Data: cc ${cc} bcc ${bcc}`,
      );
      reject(error);
    const batch = queue.shift();
    try {
      console.log('Sending email...');
      await sendEmail(batch);
    } catch (error) {
      logger.logException(error, 'Failed to send email batch');
    }


  const emailSender = function (
    recipient,
    subject,
    message,
    cc = null,
    bcc = null,
    replyTo = null,
    acknowledgingReceipt = null,
  ) {
    return new Promise((resolve, reject) => {
      if (process.env.sendEmail) {
        queue.push({
          recipient,
          subject,
          message,
          cc,
          bcc,
          replyTo,
          acknowledgingReceipt,
          resolve,
          reject,
        });
      } else {
        resolve('Email sending is disabled');
      }
    });
    setTimeout(processBatch, config.rateLimitDelay);

  };

  const concurrentProcesses = Array(config.concurrency).fill().map(processBatch);

  try {
    await Promise.all(concurrentProcesses);
  } finally {
    isProcessing = false;
  }
};

const emailSender = (
  recipients,
  subject,
  message,
  attachments = null,
  cc = null,
  replyTo = null,
) => {
  if (!process.env.sendEmail) return;
  const recipientsArray = Array.isArray(recipients) ? recipients : [recipients];
  for (let i = 0; i < recipients.length; i += config.batchSize) {
    const batchRecipients = recipientsArray.slice(i, i + config.batchSize);
    queue.push({
      from: config.email,
      bcc: batchRecipients.join(','),
      subject,
      html: message,
      attachments,
      cc,
      replyTo,
    });
  }
  console.log('Emails queued:', queue.length);
  setImmediate(processQueue);
};

module.exports = emailSender;
