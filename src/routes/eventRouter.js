const express = require('express');

const routes = function (event) {
  const controller = require('../controllers/eventController')(event);
  const eventRouter = express.Router();

  eventRouter.route('/events')
    .get(controller.getEvents);

  eventRouter.route('/events/types')
    .get(controller.getEventTypes);

  eventRouter.route('/events/locations')
    .get(controller.getEventLocations);

  return eventRouter;
};

module.exports = routes;