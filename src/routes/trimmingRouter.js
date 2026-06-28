const express = require('express');

const routes = function (TrimmingEvent) {
  const controller = require('../controllers/trimmingController')(TrimmingEvent);
  const trimmingRouter = express.Router();

  trimmingRouter.route('/').get(controller.getEvents).post(controller.postEvent);

  return trimmingRouter;
};

module.exports = routes;
