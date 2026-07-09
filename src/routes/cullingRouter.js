const express = require('express');

const routes = function (CullingEvent) {
  const controller = require('../controllers/cullingController')(CullingEvent);
  const cullingRouter = express.Router();

  cullingRouter.route('/').get(controller.getEvents).post(controller.postEvent);

  return cullingRouter;
};

module.exports = routes;
