const express = require('express');

const routes = function (buildingTool) {
  const toolsRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmToolsController')(buildingTool);
  toolsRouter.route('/tools/purchase')
    .post(controller.bmPurchaseTools);
  
  return toolsRouter;
};

module.exports = routes;
