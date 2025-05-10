const express = require('express');

const routes = function (projectCost) {
  const controller = require('../../controllers/bmdashboard/projectCostController')(projectCost);
  const projectCostRouter = express.Router();

  // Base routes for all projects
  projectCostRouter.route('/project')
    .get(controller.getAllProjects)
    .post(controller.createProject);

  // Routes for a specific project
  projectCostRouter.route('/project/:projectId')
    .get(controller.getProjectCost)
    .delete(controller.deleteProject);

  // Routes for managing cost entries of a project
  projectCostRouter.route('/project/:projectId/entries')
    .post(controller.addCostEntry);

  projectCostRouter.route('/project/:projectId/entries/:costId')
    .put(controller.updateCostEntry);

  // Route for getting cost predictions
  projectCostRouter.route('/project/:projectId/predictions')
    .get(controller.getProjectPredictions);

  // Route for getting planned and actual costs
  projectCostRouter.route('/project/:projectId/costs')
    .get(controller.getProjectCosts);

  return projectCostRouter;
};

module.exports = routes; 