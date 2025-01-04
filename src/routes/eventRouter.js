const express = require('express');

const routes = function () {
  const eventRouter = express.Router();
  console.log("Hello FROM EVENT ROUTER")
  const controller = require('../controllers/eventController');

  eventRouter.route("/EventRegistration")
    .post(controller.registerEvent)
    .get(controller.getAllEvents);

  return eventRouter;
};

module.exports = routes;