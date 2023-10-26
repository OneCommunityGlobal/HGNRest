const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const logger = require("../startup/logger");

const closure = () => {
  const queue = [];

  const CLIENT_EMAIL = process.env.REACT_APP_EMAIL;
  const CLIENT_ID = process.env.REACT_APP_EMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.REACT_APP_EMAIL_CLIENT_SECRET;
  const REDIRECT_URI = process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI;
  const REFRESH_TOKEN = process.env.REACT_APP_EMAIL_REFRESH_TOKEN;
  // Create the email envelope (transport)
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: CLIENT_EMAIL,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    },
  });

  const OAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  OAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  setInterval(async () => {
    const nextItem = queue.shift();

    if (!nextItem) return;

    const { recipient, subject, message, cc, bcc, replyTo } = nextItem;

    try {
      // Generate the accessToken on the fly
      const res = await OAuth2Client.getAccessToken();
      const ACCESSTOKEN = res.token;

      const mailOptions = {
        from: CLIENT_EMAIL,
        to: recipient,
        cc,
        bcc,
        subject,
        html: message,
        replyTo,
        auth: {
          user: CLIENT_EMAIL,
          refreshToken: REFRESH_TOKEN,
          accessToken: ACCESSTOKEN,
        },
      };

      const result = await transporter.sendMail(mailOptions);
      logger.logInfo(result);
    } catch (error) {
      logger.logException(error);
    }
  }, process.env.MAIL_QUEUE_INTERVAL || 1000);

  const emailSender = function (
    recipient,
    subject,
    message,
    cc = null,
    bcc = null,
    replyTo = null
  ) {
    if (process.env.sendEmail) {
      queue.push({
        recipient,
        subject,
        message,
        cc,
        bcc,
        replyTo,
      });
    }
  };

  return emailSender;
};

module.exports = closure();
