const express = require('express');
const { sendEmail, sendEmailToAll, updateEmailSubscriptions } = require('../controllers/emailController'); 

const routes = function () {
  const emailRouter = express.Router();

  emailRouter.route('/send-emails')
    .post(sendEmail)
  emailRouter.route( '/broadcast-emails' )
    .post( sendEmailToAll );
  
  emailRouter.route( '/update-email-subscriptions' )
    .post( updateEmailSubscriptions );

  return emailRouter;
};

module.exports = routes;
