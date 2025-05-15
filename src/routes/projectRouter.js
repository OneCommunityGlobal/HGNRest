const express = require('express');

const routes = function (project) {
  const controller = require('../controllers/projectController')(project);
  const projectRouter = express.Router();

  projectRouter.route('/projects')
    .get(controller.getAllProjects)
    .post(controller.postProject);

  projectRouter.route('/project/:projectId')
    .get(controller.getProjectById)
    .post(controller.putProject)
    .delete(controller.deleteProject)
    .put(controller.putProject);

  projectRouter.route('/projects/user/:userId')
    .get(controller.getUserProjects);

  projectRouter.route('/projects/with-active-users')
    .get(controller.getProjectsWithActiveUserCounts);

  projectRouter.route('/project/:projectId/users/')
    .post(controller.assignProjectToUsers)
    .get(controller.getprojectMembership);

  projectRouter.route('/projects/:projectId/users/search/:query')
    .get(controller.searchProjectMembers);
  return projectRouter;
};

module.exports = routes;
