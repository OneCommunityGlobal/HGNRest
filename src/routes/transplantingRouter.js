const express = require('express');

const routes = function (TransplantingEvent) {
  const controller = require('../controllers/transplantingController')(TransplantingEvent);
  const transplantingRouter = express.Router();

  transplantingRouter.route('/').get(controller.getEvents).post(controller.postEvent);

  return transplantingRouter;
};

module.exports = routes;
