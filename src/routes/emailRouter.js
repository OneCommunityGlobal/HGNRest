const express = require('express');
const { sendEmail, sendEmailToAll } = require('../controllers/emailController'); 

const routes = function () {
  const emailRouter = express.Router();

  emailRouter.route('/send-emails')
    .post(sendEmail)
  emailRouter.route( '/broadcast-emails' )
    .post( sendEmailToAll );

  return emailRouter;
};

module.exports = routes;
