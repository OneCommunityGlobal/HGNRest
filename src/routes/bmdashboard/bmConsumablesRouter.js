const express = require('express');

const routes = function (BuildingConsumable) {
  const BuildingConsumableController = express.Router();
  const controller = require('../../controllers/bmdashboard/bmConsumableController')(BuildingConsumable);

  BuildingConsumableController.route('/consumables')
    .get(controller.fetchBMConsumables);
  
  BuildingConsumableController.route('/updateConsumablesRecord')
    .post(controller.bmPostConsumableUpdateRecord);

  return BuildingConsumableController;
};

module.exports = routes;
