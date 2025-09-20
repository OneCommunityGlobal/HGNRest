const express = require('express');

const routes = function () {
  const projectCostRouter = express.Router();

  // Base routes for all projects
  projectCostRouter
    .route('/project')
    .get((req, res) => res.json({ message: 'Get all projects' }))
    .post((req, res) => res.json({ message: 'Create project' }));

  // Route for getting cost predictions
  projectCostRouter
    .route('/project/:projectId/predictions')
    .get((req, res) => res.json({ message: 'Get project predictions' }));

  // Route for getting planned and actual costs
  projectCostRouter
    .route('/project/:projectId/costs')
    .get((req, res) => res.json({ message: 'Get project costs' }));

  return projectCostRouter;
};

module.exports = routes;
