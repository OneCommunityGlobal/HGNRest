const express = require('express');

const routes = function (BuildingConsumable) {
  const BuildingConsumableController = express.Router();
  const controller = require('../../controllers/bmdashboard/bmConsumableController')(BuildingConsumable);

  BuildingConsumableController.route('/consumables')
    .get(controller.fetchBMConsumables);

  BuildingConsumableController.route('/consumables/purchase')
    .post(controller.bmPurchaseConsumables);

  return BuildingConsumableController;
};

module.exports = routes;
