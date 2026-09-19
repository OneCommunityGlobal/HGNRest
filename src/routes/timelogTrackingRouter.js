const express = require('express');

const routes = function () {
  const timelogTrackingRouter = express.Router();

  const controller = require('../controllers/timelogTrackingController');

  // Get timelog tracking events for a user
  timelogTrackingRouter.route('/timelogTracking/:userId').get(controller.getTimelogTracking);

  return timelogTrackingRouter;
};

module.exports = routes;
