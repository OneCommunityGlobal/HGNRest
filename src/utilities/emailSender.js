const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const logger = require('../startup/logger');

const config = {
  email: process.env.REACT_APP_EMAIL,
  clientId: process.env.REACT_APP_EMAIL_CLIENT_ID,
  clientSecret: process.env.REACT_APP_EMAIL_CLIENT_SECRET,
  redirectUri: process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI,
  refreshToken: process.env.REACT_APP_EMAIL_REFRESH_TOKEN,
  batchSize: 100,
  batchDelay: 60000,
  mailQueueInterval: process.env.MAIL_QUEUE_INTERVAL || 60000,
};

const closure = () => {
  const queue = [];

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

  const OAuth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
  OAuth2Client.setCredentials({ refresh_token: config.refreshToken });

  const processQueue = async () => {
    const delay = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });

    const sendEmail = async (item) => {
      const { recipient, subject, message, attachments, cc, bcc, replyTo, acknowledgingReceipt } =
        item;

      try {
        const res = await OAuth2Client.getAccessToken();
        const accessToken = res.token;

        const mailOptions = {
          from: config.email,
          to: recipient,
          cc,
          bcc,
          subject,
          html: message,
          attachments,
          replyTo,
          auth: {
            user: config.email,
            refreshToken: config.refreshToken,
            accessToken,
          },
        };

        const result = await transporter.sendMail(mailOptions);
        if (typeof acknowledgingReceipt === 'function') {
          acknowledgingReceipt(null, result);
        }
        if (process.env.NODE_ENV === 'local') {
          logger.logInfo(`Email sent: ${JSON.stringify(result)}`);
        }
      } catch (error) {
        if (typeof acknowledgingReceipt === 'function') {
          acknowledgingReceipt(error, null);
        }
        logger.logException(
          error,
          `Error sending email: from ${config.email} to ${recipient} subject ${subject}`,
          `Extra Data: cc ${cc} bcc ${bcc}`,
        );
      }
    };

    const processBatch = async (batch) => {
      await batch.reduce(async (previousPromise, item) => {
        console.log('item', item);
        await previousPromise;
        await sendEmail(item);
        await delay(1000);
      }, Promise.resolve());
    };

    const processAllBatches = async () => {
      if (queue.length === 0) {
        setTimeout(processQueue, config.mailQueueInterval);
        return;
      }

      const batch = queue.splice(0, config.batchSize);
      console.log('processBatch', batch);
      await processBatch(batch);

      if (queue.length > 0) {
        setTimeout(processAllBatches, config.batchDelay);
      } else {
        setTimeout(processQueue, config.mailQueueInterval);
      }
    };
    console.log('processAllBatches in queue');
    processAllBatches();
  };

  processQueue();

  const emailSender = function (
    recipient,
    subject,
    message,
    attachments = null,
    cc = null,
    bcc = null,
    replyTo = null,
    acknowledgingReceipt = null,
  ) {
    if (process.env.sendEmail) {
      queue.push({
        recipient,
        subject,
        message,
        attachments,
        cc,
        bcc,
        replyTo,
        acknowledgingReceipt,
      });
    }
  };

  return emailSender;
};

module.exports = closure();
