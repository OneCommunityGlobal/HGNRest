const express = require('express');

const routes = function (buildingProject) {
  const projectRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmProjectController')(buildingProject);

projectRouter.route('/projects')
  .get(controller.fetchAllProjects);

projectRouter.route('/project/:projectId')
  .get(controller.fetchSingleProject);

  projectRouter.route('/project/:projectId/users')
  .get(controller.fetchProjectMembers);
  
  return projectRouter;
};

module.exports = routes;
