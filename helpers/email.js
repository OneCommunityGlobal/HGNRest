'use strict';
const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require("../startup/logger");
var emailuser = function() {

    const message = `Assign blue badge job is starting`;

    nodemailer.createTestAccount((err, account) => {

        let transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: "highestgoodnetwork@gmail.com",
                pass: "123Sowmya!"
            },
            tls: {
                rejectUnauthorized: false
            }
        });


        let mailOptions = {
            from: '"One community"' + config.SMTPUser,
            to: "shubhra.goel@gmail.com",
            subject: 'Blue badge job starting',
            text: "Shubhra",
            html: message// html body
        };

       return transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                logger.logException(error);
                return error;
            }
            logger.logInfo('Message sent: %s', info.messageId);
      
        });
    });


}

module.exports = emailuser;