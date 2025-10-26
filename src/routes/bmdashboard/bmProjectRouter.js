const express = require('express');
const projectStatusController = require('../../controllers/bmdashboard/projectStatusController');

const routes = function (buildingProject) {
  const projectRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmProjectController')(buildingProject);

  projectRouter.route('/projects').get(controller.fetchAllProjects);

  projectRouter.route('/project/:projectId').get(controller.fetchSingleProject);

  projectRouter.route('/projectsNames').get(controller.fetchProjectsNames);

  projectRouter.route('/project/:projectId/users').get(controller.fetchProjectMembers);

  projectRouter.route('/projects/status').get(projectStatusController.getProjectStatusSummary);

  return projectRouter;
};

module.exports = routes;
