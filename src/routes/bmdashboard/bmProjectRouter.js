const express = require('express');

const routes = function (buildingProject) {
  const projectRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmProjectController')(buildingProject);

projectRouter.route('/projects/:userId')
  .get(controller.fetchAllProjects);

projectRouter.route('/projects/:userId/:projectId')
  .get(controller.fetchSingleProject);

  return projectRouter;
};

module.exports = routes;
