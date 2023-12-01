const express = require('express');

const routes = function (invType) {
  const inventoryTypeRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmInventoryTypeController')(invType);

  // Route for fetching all material types
  inventoryTypeRouter.route('/invtypes/materials')
    .get(controller.fetchMaterialTypes);

  // Combined routes for getting a single inventory type and updating its name and unit of measurement
  inventoryTypeRouter.route('/invtypes/material/:invtypeId')
    .get(controller.fetchSingleInventoryType)
    .put(controller.updateNameAndUnit);
  return inventoryTypeRouter;
};

module.exports = routes;
