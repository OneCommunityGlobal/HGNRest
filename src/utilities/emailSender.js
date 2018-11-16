
const nodemailer = require('nodemailer');
const logger = require('../startup/logger');

const emailSender = function (recipient, subject, message, cc = null, bcc = null) {
  nodemailer.createTestAccount(() => {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTPDomain,
      port: process.env.SMTPPort,
      secure: true,
      auth: {
        user: process.env.SMTPUser,
        pass: process.env.SMTPPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    logger.logInfo(transporter);


    const mailOptions = {
      from: process.env.SMTPUser,
      to: recipient,
      cc,
      bcc,
      subject,
      html: message,

    };

    return transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        logger.logException(error);
        return error;
      }
      logger.logInfo(info);
      return info;
    });
  });
};

module.exports = emailSender;
