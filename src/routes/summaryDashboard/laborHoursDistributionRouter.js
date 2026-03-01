const express = require('express');

/**
 * Router for Labor Hours Distribution API
 *
 * Endpoint:
 * - GET /distribution - Get labor hours distribution for pie chart
 */
const routes = function () {
  const controller =
    require('../../controllers/summaryDashboard/laborHoursDistributionController')();
  const laborHoursRouter = express.Router();

  /**
   * @route   GET /distribution
   * @desc    Get aggregated labor hours distribution for pie chart
   * @query   start_date (required) - Start date in YYYY-MM-DD format
   * @query   end_date (required) - End date in YYYY-MM-DD format
   * @query   category (optional) - Filter by specific category
   * @access  Protected
   */
  laborHoursRouter.route('/distribution').get(controller.getLaborHoursDistribution);

  return laborHoursRouter;
};

module.exports = routes;
