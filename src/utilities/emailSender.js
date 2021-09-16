const nodemailer = require('nodemailer');
const logger = require('../startup/logger');

const closure = () => {
  const queue = [];

  setInterval(() => {
    const nextItem = queue.shift();

    if (!nextItem) return;

    const {
      recipient, subject, message, cc, bcc,
    } = nextItem;

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
  }, process.env.MAIL_QUEUE_INTERVAL || 1000);

  /**
   *
   * @param {string} recipient A comma-seperated list of recipients for this email. Examples: 'cow@cow.jp' OR 'cow@cow.jp, cow23@cow.jp'
   * @param {string} subject Email subject
   * @param {string} message HTML formatted email body
   * @param {*} cc
   * @param {*} bcc
   */
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
