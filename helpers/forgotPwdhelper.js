'use strict';
const nodemailer = require('nodemailer');

var forgotPwdModule = function(user,ranPwd){

    const message =`<b> hi ${user.firstName},</b>
    <p>your 'forgot password' request was recieved and here is your new password.</p>
    <blockquote> ${ranPwd}</blockquote>
    <p>Please change the password after logging in using update password tab under your profile.Do not reply to this mail. </P>
    <p> Regards,<p>
    <p>One community</p>
    `;

nodemailer.createTestAccount((err, account) => {
   
    let transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: account.user, // generated ethereal user
            pass: account.pass // generated ethereal password
        },
        tls: {
            rejectUnauthorized: false
        }
    });


    let mailOptions = {
        from: '"One community" <foo@example.com>', 
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