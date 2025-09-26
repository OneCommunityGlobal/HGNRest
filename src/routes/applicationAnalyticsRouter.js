const express = require('express');

const routes = function (ApplicationAnalytics) {
  const controller = require('../controllers/applicationAnalyticsController')(ApplicationAnalytics);
  const applicationAnalyticsRouter = express.Router();

  // GET /applications?filter=weekly/monthly/yearly&roles=[role1,role2]
  // Fetch application data for the selected time frame with optional role filtering
  applicationAnalyticsRouter.route('/applications').get(controller.getApplications);

  // GET /comparison?filter=weekly/monthly/yearly&roles=[role1,role2]
  // Return percentage change compared to the previous time period
  applicationAnalyticsRouter.route('/comparison').get(controller.getComparison);

  // POST /applications
  // Create or update application analytics data
  applicationAnalyticsRouter.route('/applications').post(controller.createApplicationData);

  // GET /roles
  // Get all available roles for multi-select filtering
  applicationAnalyticsRouter.route('/roles').get(controller.getAvailableRoles);

  return applicationAnalyticsRouter;
};

module.exports = routes;
