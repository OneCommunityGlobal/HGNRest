const express = require('express');

const routes = function (buildingProject) {
  const projectRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmProjectController')(buildingProject);

projectRouter.route('/projects')
  .get(controller.bmProjectSummary);

  return projectRouter;
};

module.exports = routes;
