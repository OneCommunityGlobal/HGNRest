const express = require('express');

const routes = function (userProfile) {
  const projectsRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmProjectsController')(userProfile);

projectsRouter.route('/projects/:userId')
  .get(controller.bmProjectsSummary);

  return projectsRouter;
};

module.exports = routes;
