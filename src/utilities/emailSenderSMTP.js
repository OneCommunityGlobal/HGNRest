const nodemailer = require('nodemailer');
const logger = require('../startup/logger');

const config = {
    email: process.env.SMTPUser,
    password: process.env.SMTPPass,
    host: process.env.SMTPDomain,
    port: process.env.SMTPPort,
};

const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port == 465,
    auth: {
        user: config.email,
        pass: config.password,
    },
});

const sendEmailSMTP = async (mailOptions) => {
    try {
        console.log("📩 Sending email via SMTP...");
        console.log("SMTP Config:", config);

        const result = await transporter.sendMail(mailOptions);
        console.log("✅ Email sent:", result);
        return result;
    } catch (error) {
        console.error("❌ Error sending email:", error.message);
        logger.logException(error, `Error sending email to: ${mailOptions.to}`);
        throw error;
    }
};

const emailSenderSMTP = (recipients, subject, message, attachments = null, cc = null, replyTo = null) => {
    const recipientsArray = Array.isArray(recipients) ? recipients : [recipients];

    const mailOptions = {
        from: config.email,
        to: recipientsArray.join(','),
        subject,
        html: message,
        attachments,
        cc,
        replyTo,
    };

    console.log("📩 Adding email to SMTP queue:", mailOptions.to);
    return sendEmailSMTP(mailOptions);
};

module.exports = emailSenderSMTP;
