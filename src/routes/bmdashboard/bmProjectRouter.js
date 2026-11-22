const express = require('express');

const routes = function (buildingProject) {
  const projectRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmProjectController')(buildingProject);

  projectRouter
    .route('/projects')
    .get(controller.fetchAllProjects)
    .post(controller.createProject);

  projectRouter.route('/projects/location').get(controller.fetchProjectsWithLocation);

  projectRouter
    .route('/project/:projectId')
    .get(controller.fetchSingleProject)
    .put(controller.updateProject);

  projectRouter.route('/projectsNames').get(controller.fetchProjectsNames);

  projectRouter.route('/project/:projectId/users').get(controller.fetchProjectMembers);

  return projectRouter;
};

module.exports = routes;
