
const express = require('express');

const routes = function () {
  const controller = require('../controllers/isEmailExistsController')();

  const isEmailExistsRouter = express.Router();

  isEmailExistsRouter.route('/is-email-exists/:email')
    .get(controller.isEmailExists);

  return isEmailExistsRouter;
};

module.exports = routes;
