const express = require('express');

const routes = function (DashboardMetrics, BuildingProject, BuildingMaterial) {
  const dashboardRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmDashboardPrototypeController')(
    DashboardMetrics,
    BuildingProject,
    BuildingMaterial
  );

  // Get latest material cost data with month-over-month trends
  dashboardRouter.route('/dashboard/materials/costs')
    .get(controller.getMaterialCostTrends);

  // Get all dashboard metrics in a single call
  dashboardRouter.route('/dashboard/metrics')
    .get(controller.getAllMetrics);

  // Get historical metrics for trend analysis
  dashboardRouter.route('/dashboard/metrics/history')
    .get(controller.getHistoricalMetrics);

  // Force refresh of dashboard metrics
  dashboardRouter.route('/dashboard/metrics/refresh')
    .post(controller.refreshMetrics);

  return dashboardRouter;
};

module.exports = routes;