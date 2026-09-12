const express = require('express');

const routes = function (PlantingEvent) {
  const controller = require('../controllers/plantingController')(PlantingEvent);
  const plantingRouter = express.Router();

  plantingRouter.route('/').get(controller.getEvents).post(controller.postEvent);

  return plantingRouter;
};

module.exports = routes;
