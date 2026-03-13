const express = require('express');

const routes = function (HarvestingEvent) {
  const controller = require('../controllers/harvestingController')(HarvestingEvent);
  const harvestingRouter = express.Router();

  harvestingRouter.route('/').get(controller.getEvents).post(controller.postEvent);

  return harvestingRouter;
};

module.exports = routes;
