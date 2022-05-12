const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const logger = require('../startup/logger');


const closure = () => {
  const queue = [];
  setInterval(async () => {
    const nextItem = queue.shift();

    if (!nextItem) return;

    const {
      recipient, subject, message, cc, bcc,
    } = nextItem;

    const CLIENT_EMAIL = process.env.REACT_APP_EMAIL;
    const CLIENT_ID = process.env.REACT_APP_EMAIL_CLIENT_ID;
    const CLIENT_SECRET = process.env.REACT_APP_EMAIL_CLIENT_SECRET;
    const REDIRECT_URI = process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI;
    const REFRESH_TOKEN = process.env.REACT_APP_EMAIL_REFRESH_TOKEN;
    const OAuth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI,
    );
    logger.logInfo('test refresh token : ', REFRESH_TOKEN);
    OAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    try {
      // Generate the accessToken on the fly
      const ACCESSTOKEN = await OAuth2Client.getAccessToken();
      logger.logInfo(ACCESSTOKEN);

      // Create the email envelope (transport)
      const transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: CLIENT_EMAIL,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          refreshToken: REFRESH_TOKEN,
          accessToken: ACCESSTOKEN,
        },
      });

      logger.logInfo(transport);

      const mailOptions = {
        from: process.env.SMTPUser,
        to: recipient,
        cc,
        bcc,
        subject,
        html: message,
      };

      const result = await transport.sendMail(mailOptions);
      logger.logInfo(result);
    } catch (error) {
      logger.logException(error);
    }
  }, process.env.MAIL_QUEUE_INTERVAL || 1000);

  const emailSender = function (recipient, subject, message, cc = null, bcc = null) {
    if (process.env.sendEmail) {
      queue.push({
        recipient, subject, message, cc, bcc,
      });
    }
  };

  return emailSender;
};

module.exports = closure();
