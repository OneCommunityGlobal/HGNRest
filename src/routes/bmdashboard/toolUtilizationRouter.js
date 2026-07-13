const express = require('express');

const routes = function (BuildingTool) {
  const toolUtilizationRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/toolUtilizationController')(
    BuildingTool,
  );

  toolUtilizationRouter.route('/tools/utilization').get(controller.getUtilization);

  return toolUtilizationRouter;
};

module.exports = routes;
