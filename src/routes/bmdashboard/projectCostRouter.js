const express = require('express');

const routes = function (projectCost) {
  const controller = require('../../controllers/bmdashboard/projectCostController')(projectCost);
  const projectCostRouter = express.Router();

  // Base routes for all projects
  projectCostRouter.route('/costs')
    .get(controller.getAllProjects)
    .post(controller.createProject);

  // Routes for a specific project
  projectCostRouter.route('/costs/:projectId')
    .get(controller.getProjectCost)
    .delete(controller.deleteProject);

  // Routes for managing cost entries of a project
  projectCostRouter.route('/costs/:projectId/entries')
    .post(controller.addCostEntry);

  projectCostRouter.route('/costs/:projectId/entries/:costId')
    .put(controller.updateCostEntry);

  return projectCostRouter;
};

module.exports = routes; 