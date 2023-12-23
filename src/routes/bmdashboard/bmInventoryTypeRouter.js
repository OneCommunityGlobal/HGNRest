const express = require('express');

const routes = function (matType, consType, reusType, toolType, equipType) {
  const inventoryTypeRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmInventoryTypeController')(matType, consType, reusType, toolType, equipType);

  inventoryTypeRouter.route('/invtypes/materials')
    .get(controller.fetchMaterialTypes);

  inventoryTypeRouter.route('/invtypes/equipment')
    .post(controller.addEquipmentType);

  return inventoryTypeRouter;
};

module.exports = routes;
