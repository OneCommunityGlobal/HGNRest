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

  // Route for fetching types by selected type
  inventoryTypeRouter.route('/invtypes/:type').get(controller.fetchInventoryByType);

  // Combined routes for getting a single inventory type and updating its name and unit of measurement
  inventoryTypeRouter
    .route('/invtypes/material/:invtypeId')
    .get(controller.fetchSingleInventoryType);

  inventoryTypeRouter
    .route('/inventoryUnits')
    .get(controller.fetchInvUnitsFromJson)
    .post(controller.addInvUnit)
    .delete(controller.deleteInvUnit);

  // update or delete an inventory type in any category
  inventoryTypeRouter
    .route('/invtypes/:type/:invtypeId')
    .put(controller.updateSingleInvType)
    .delete(controller.deleteSingleInvType);

  return inventoryTypeRouter;
};

module.exports = routes;
