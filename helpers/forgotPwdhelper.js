'use strict';
const nodemailer = require('nodemailer');
const config = require('../config');
var forgotPwdModule = function (user, ranPwd) {

    const message = `<b> Hi ${user.firstName},</b>
    <p>Do not reply to this mail.</p>
    <p>Your 'forgot password' request was recieved and here is your new password:</p>
    <blockquote> ${ranPwd}</blockquote>
    <p>Please change this password the next time you log in. Do this by clicking the arrow in the top-right corner by your profile picture and then selecting the "Update Password" option. </P>
    <p>Thank you,<p>
    <p>One Community</p>
    `;

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
            to: user.email,
            subject: 'Account Password change',
            text: user.firstName,
            html: message// html body
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('Message sent: %s', info.messageId);
            // Preview only available when sending through an Ethereal account
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        });
    });


}
module.exports = forgotPwdModule;