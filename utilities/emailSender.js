'use strict';
const nodemailer = require('nodemailer');
const logger = require("../startup/logger");

var emailSender = function(recipient,subject, message, cc =null, bcc=null) {

    nodemailer.createTestAccount((err, account) => {

        let transporter = nodemailer.createTransport({
            host: process.env.SMTPDomain,
            port: process.env.SMTPPort,
            secure: true,
            auth: {
                user: process.env.SMTPUser,
                pass: process.env.SMTPPass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        logger.logInfo(transporter)


        let mailOptions = {
            from: process.env.SMTPUser,
            to: recipient,
            cc: cc,
            bcc: bcc,
            subject: subject,
            html:message,
             
        };

       return transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                logger.logException(error)
                return error;
            }
            logger.logInfo(info);
                });
    });


}

module.exports = emailSender;