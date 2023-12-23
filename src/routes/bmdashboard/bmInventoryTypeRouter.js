const express = require('express');

const routes = function (invType,invUnit) {
  const inventoryTypeRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmInventoryTypeController')(invType,invUnit);

  inventoryTypeRouter.route('/invtypes/materials')
    .get(controller.fetchMaterialTypes);

    inventoryTypeRouter.route('/invtypes/material')
    .post(controller.addBuildingInventoryType);

  return inventoryTypeRouter;
};

module.exports = routes;
