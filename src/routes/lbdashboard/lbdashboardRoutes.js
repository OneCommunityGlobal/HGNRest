const express = require('express');

const routes = function () {
  const registerRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/lbdashboardController');

  registerRouter.route('/register')
    .post(controller.registerUser);

  return registerRouter;
};

module.exports = routes;
