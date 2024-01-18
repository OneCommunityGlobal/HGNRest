const express = require('express');

const routes = function (baseInvType, matType, consType, reusType, toolType, equipType) {
  const inventoryTypeRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmInventoryTypeController')(baseInvType, matType, consType, reusType, toolType, equipType);

  // Route for fetching all material types
  inventoryTypeRouter.route('/invtypes/materials')
    .get(controller.fetchMaterialTypes);

  inventoryTypeRouter.route('/invtypes/equipment')
    .post(controller.addEquipmentType);

  inventoryTypeRouter.route('/invtypes/consumables')
    .get(controller.fetchConsumableTypes);

  // Combined routes for getting a single inventory type and updating its name and unit of measurement
  inventoryTypeRouter.route('/invtypes/material/:invtypeId')
    .get(controller.fetchSingleInventoryType)
    .put(controller.updateNameAndUnit);
  return inventoryTypeRouter;
};

module.exports = routes;
