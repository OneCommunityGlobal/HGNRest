const express = require('express');


const routes = function () {
  const controller = require('../controllers/timeZoneAPIController')();
  const timeZoneAPIRouter = express.Router();

  timeZoneAPIRouter.route('/timezone')
    .get(controller.getTimeZoneAPIKey);

  return timeZoneAPIRouter;
};

module.exports = routes;
