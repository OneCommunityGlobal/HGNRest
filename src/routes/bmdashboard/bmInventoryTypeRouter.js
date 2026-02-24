const express = require('express');

const routes = function (baseInvType, matType, consType, reusType, toolType, equipType) {
  const inventoryTypeRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmInventoryTypeController')(
    baseInvType,
    matType,
    consType,
    reusType,
    toolType,
    equipType,
  );

  // Route for fetching all material types
  inventoryTypeRouter.route('/invtypes/materials').get(controller.fetchMaterialTypes);

  inventoryTypeRouter.route('/invtypes/reusables').get(controller.fetchReusableTypes);

  inventoryTypeRouter.route('/invtypes/material').post(controller.addMaterialType);

  inventoryTypeRouter.route('/consumables').post(controller.addConsumableType);

  inventoryTypeRouter.route('/tools').post(controller.addToolType);

  inventoryTypeRouter.route('/invtypes/tools').get(controller.fetchToolTypes);

  inventoryTypeRouter.route('/invtypes/equipment').post(controller.addEquipmentType);

  inventoryTypeRouter.route('/invtypes/equipments').get(controller.fetchEquipmentTypes);

  inventoryTypeRouter.route('/invtypes/consumables').get(controller.fetchConsumableTypes);

  // Combined routes for getting a single inventory type and updating its name and unit of measurement
  inventoryTypeRouter
    .route('/invtypes/material/:invtypeId')
    .get(controller.fetchSingleInventoryType)
    .put(controller.updateNameAndUnit);

  // Generic route for updating/deleting any inventory type by ID
  // Using regex to match MongoDB ObjectId format (24 hex characters) - must come BEFORE :type route
  inventoryTypeRouter
    .route('/invtypes/:invtypeId([0-9a-fA-F]{24})')
    .get(controller.fetchSingleInventoryType)
    .put(controller.updateInventoryType)
    .delete(controller.deleteInventoryType);

  // Route for fetching types by selected type (Materials, Consumables, etc.)
  // This comes AFTER the ObjectId route so it only matches non-ObjectId strings
  inventoryTypeRouter.route('/invtypes/:type').get(controller.fetchInventoryByType);

  // Routes for inventory units (JSON file based)
  inventoryTypeRouter
    .route('/inventoryUnits')
    .get(controller.fetchInvUnitsFromJson)
    .post(controller.addInventoryUnit);

  inventoryTypeRouter
    .route('/inventoryUnits/:unitName')
    .delete(controller.deleteInventoryUnit);

  return inventoryTypeRouter;
};

module.exports = routes;
