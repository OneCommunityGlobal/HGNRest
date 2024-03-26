const express = require('express');

const routes = function () {
  const loginrouter = express.Router();
  const controller = require('../controllers/logincontroller')();

  loginrouter.route('/login')
    .get(controller.getUser)
    .post(controller.login);

  return loginrouter;
};

module.exports = routes;
