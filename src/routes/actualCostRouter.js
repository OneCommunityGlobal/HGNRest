const express = require('express');

const routes = function () {
  const controller = require('../controllers/actualCostController')();
  const actualCostRouter = express.Router();

  // GET /api/projects/:id/actual-cost-breakdown
  actualCostRouter
    .route('/projects/:id/actual-cost-breakdown')
    .get(controller.getActualCostBreakdown);

  return actualCostRouter;
};

module.exports = routes;
