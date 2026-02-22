const express = require('express');

const routes = () => {
  const controller = require('../controllers/bitwardenPasswordController')();
  const bitwardenPasswordRouter = express.Router();

  // Auth endpoints
  bitwardenPasswordRouter.route('/vault/retrieve').get(controller.vaultItemRetrival);

  return bitwardenPasswordRouter;
};

module.exports = routes;
