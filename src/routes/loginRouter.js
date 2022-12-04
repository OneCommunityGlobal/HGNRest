const express = require('express');


const routes = function () {
  const loginRouter = express.Router();
  const controller = require('../controllers/loginController');

  loginRouter.route('/login')
    .get(controller.getUser)
    .post(controller.login);

  return loginRouter;
};

module.exports = routes;
