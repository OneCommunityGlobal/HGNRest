const express = require('express');

const routes = function (buildingInventoryType) {
  
    const buildingInventoryTypeRouter = express.Router();
    const controller = require('../../controllers/bmdashboard/bmInventoryTypeController')(buildingInventoryType);

    buildingInventoryTypeRouter.route('/buildingInventoryTypes')
      .get(controller.buildingInventoryTypeList);

    return buildingInventoryTypeRouter;
};

module.exports = routes;
