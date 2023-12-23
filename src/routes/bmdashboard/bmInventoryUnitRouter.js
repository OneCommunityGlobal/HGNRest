const express = require('express');

const routes = function (InvUnit) {
  const inventoryUnitRouter = express.Router();
    
    const controller = require('../../controllers/bmdashboard/bmInventoryUnitController')(InvUnit);

    inventoryUnitRouter.route('/inventoryUnits')
    .get(controller.fetchInvUnits);

    inventoryUnitRouter.route('/inventoryUnits')
    .post(controller.addBuildingInventoryUnit);

  return inventoryUnitRouter;
};

module.exports = routes;
