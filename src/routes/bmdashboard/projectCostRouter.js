const express = require('express');

const routes = function (projectCost) {
  const controller = require('../../controllers/bmdashboard/projectCostTrackingController')(
    projectCost,
  );
  const projectCostRouter = express.Router();

  // Route for getting all project IDs
  projectCostRouter.route('/project/ids').get(controller.getAllProjectIds);

  // Route for getting planned and actual costs
  projectCostRouter.route('/project/:projectId/costs').get(controller.getProjectCosts);

  return projectCostRouter;
};

module.exports = routes;
