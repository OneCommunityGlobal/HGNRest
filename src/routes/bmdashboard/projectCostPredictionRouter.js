const express = require('express');

const routes = function (projectCostPrediction) {
  const controller = require('../../controllers/bmdashboard/projectCostPredictionController')(projectCostPrediction);
  const projectCostPredictionRouter = express.Router();

  projectCostPredictionRouter.route('/')
    .get(controller.getAllProjectCostPredictions)
    .post(controller.createProjectCostPrediction);

  projectCostPredictionRouter.route('/project/:projectId')
    .get(controller.getProjectCostPredictionsByProjectId);

  projectCostPredictionRouter.route('/:id')
    .put(controller.updateProjectCostPrediction)
    .delete(controller.deleteProjectCostPrediction);

  return projectCostPredictionRouter;
};

module.exports = routes; 