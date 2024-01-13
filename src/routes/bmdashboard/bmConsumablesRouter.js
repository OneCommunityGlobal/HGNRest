const express = require('express');

const routes = function (BuildingConsumable) {
  const BuildingConsumableController = express.Router();
  const controller = require('../../controllers/bmdashboard/bmConsumableController')(BuildingConsumable);

  BuildingConsumableController.route('/consumables')
    .get(controller.fetchBMConsumables);

  return BuildingConsumableController;
};

module.exports = routes;
