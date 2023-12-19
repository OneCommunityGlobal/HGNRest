const express = require('express');

const routes = function (invType) {
  const inventoryTypeRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmInventoryTypeController')(invType);

  inventoryTypeRouter.route('/invtypes/materials')
    .get(controller.fetchMaterialTypes);

    inventoryTypeRouter.route('/postBuildingInventoryType')
    .post(controller.addBuildingInventoryType);

  return inventoryTypeRouter;
};

module.exports = routes;
