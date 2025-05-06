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

const emailSender = (
  recipients,
  subject,
  message,
  attachments = null,
  cc = null,
  replyTo = null,
) => {
  if (!process.env.sendEmail) return;
  return new Promise((resolve, reject) => {
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
      from: config.email,
      to: recipientEmail,
      subject: `Unread Messages Summary`,
      html: emailContent,
    });
  } catch (error) {
    console.error(`❌ Failed to send summary email to ${recipientEmail}:`, error);
  }
};

module.exports = {emailSender, sendSummaryNotification};
