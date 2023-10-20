const express = require('express');

const routes = function () {
  const projectsRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmProjectsController')();
// const controller = require('../../controllers/bmdashboard/bmMaterialsController')(itemMaterial);

projectsRouter.route('/projects')
  .get(controller.bmProjectsSummary);

  return projectsRouter;
};

module.exports = routes;
