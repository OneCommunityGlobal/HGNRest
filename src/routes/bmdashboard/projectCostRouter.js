const express = require('express');

const routes = function (projectCost) {
  const controller = require('../../controllers/bmdashboard/projectCostController')(projectCost);
  const projectCostRouter = express.Router();

  // Base routes for all projects
  projectCostRouter.route('/project')
    .get(controller.getAllProjects)
    .post(controller.createProject);
    
  // Route for getting cost predictions
  projectCostRouter.route('/project/:projectId/predictions')
    .get(controller.getProjectPredictions);

  // Route for getting planned and actual costs
  projectCostRouter.route('/project/:projectId/costs')
    .get(controller.getProjectCosts);

  return projectCostRouter;
};

module.exports = routes; 