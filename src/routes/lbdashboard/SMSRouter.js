const express = require('express');
const SMSController = require('../../controllers/lbdashboard/smsController');

const routes = function () {
  const SMSRouter = express.Router();

  SMSRouter.route('/TwilioSendSMS').post(SMSController.twilioSendSMS);

  SMSRouter.route('/TextbeltSMS').post(SMSController.TextbeltSMS);

  SMSRouter.route('/TelesignSMS').post(SMSController.TelesignSMS);

  return SMSRouter;
};

module.exports = routes;
