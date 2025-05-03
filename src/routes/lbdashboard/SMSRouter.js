const express = require('express');
const SMSController = require('../../controllers/lbdashboard/smsController');

const routes = function () {
  console.log('SMSRouter');
  const SMSRouter = express.Router();

  SMSRouter.route('/sendSMS').post(SMSController.sendSMS);

  SMSRouter.route('/TextbeltSMS').post(SMSController.TextbeltSMS);

  return SMSRouter;
};

module.exports = routes;
