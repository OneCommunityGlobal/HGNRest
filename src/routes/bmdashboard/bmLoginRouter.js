const express = require('express');

const routes = function () {
  const loginrouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmLoginController')();

  loginrouter.route('/login')
    .post(controller.bmLogin);

  return loginrouter;
};

module.exports = routes;
