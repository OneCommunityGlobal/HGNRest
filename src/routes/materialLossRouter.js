const express = require('express');

const routes = function (materialLossModel) {
  const router = express.Router();
  const controller = require('../controllers/materialLossController')(materialLossModel);

  router.route('/loss-tracking')
    .get(controller.getMaterialLossData);

  return router;
};

module.exports = routes;