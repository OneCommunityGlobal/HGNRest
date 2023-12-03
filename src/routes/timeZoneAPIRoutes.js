const express = require('express');


const routes = function () {
  const controller = require('../controllers/timeZoneAPIController')();
  const timeZoneAPIRouter = express.Router();

  timeZoneAPIRouter.route('/timezone/:location')
    .get(controller.getTimeZone)
    .post(controller.getTimeZoneProfileInitialSetup);

  return timeZoneAPIRouter;
};

module.exports = routes;
