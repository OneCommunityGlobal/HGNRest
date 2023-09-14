const express = require('express');
const { sendEmail } = require('../controllers/emailController'); 

const routes = function () {
  const emailRouter = express.Router();

  emailRouter.route('/send-emails')
    .post(sendEmail); 

  return emailRouter;
};

module.exports = routes;
