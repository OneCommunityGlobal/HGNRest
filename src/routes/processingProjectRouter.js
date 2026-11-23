const express = require('express');

const routes = function (ProcessingProject) {
  const controller = require('../controllers/processingProjectController')(ProcessingProject);
  const processingProjectRouter = express.Router();

  processingProjectRouter.route('/').post(controller.postProject).get(controller.getProjects);

  return processingProjectRouter;
};

module.exports = routes;
