const express = require('express');

const routes = function () {
  const loginrouter = express.Router();
  const controller = require('../../controllers/biddingdashboard/biddingLoginController')();

  loginrouter.route('/login').post(controller.biddingLogin);

  return loginrouter;
};

module.exports = routes;
