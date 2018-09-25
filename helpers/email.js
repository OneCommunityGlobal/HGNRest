'use strict';
const nodemailer = require('nodemailer');
const config = require('../config');
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
                return error;
            }
            console.log('Message sent: %s', info.messageId);
            // Preview only available when sending through an Ethereal account
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        });
    });


}

module.exports = emailuser;