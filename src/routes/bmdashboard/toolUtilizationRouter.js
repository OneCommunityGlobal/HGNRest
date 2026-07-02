const express = require('express');

const routes = function (BuildingTool) {
  const toolUtilizationRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/toolUtilizationController')(
    BuildingTool,
  );

  toolUtilizationRouter.route('/tools/utilization').get(controller.getUtilization);
  toolUtilizationRouter.route('/tools/utilization/insights').get(controller.getInsights);
  toolUtilizationRouter.route('/tools/utilization/export').get(controller.exportReport);

  return toolUtilizationRouter;
};

module.exports = routes;
