'use strict';
const config = require('../config');
const emailSender = require("../utilities/emailSender")

var forgotPwdModule = function (user, ranPwd) {

    const message = `<b> Hello ${user.firstName} ${user.lastName},</b>
    <p>Do not reply to this mail.</p> 
    <p>Your 'forgot password' request was recieved and here is your new password:</p>
    <blockquote> ${ranPwd}</blockquote>
    <p>Please change this password the next time you log in. Do this by clicking the arrow in the top-right corner by your profile picture and then selecting the "Update Password" option. </P>
    <p>Thank you,<p>
    <p>One Community</p>
    `;

    emailSender({
        recipient = "user.email",
        subject = "Account Password change", 
        message = message , 
        cc =null, 
        bcc=null
    })


}
module.exports = forgotPwdModule;