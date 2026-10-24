const express = require('express');

const routes = function () {
  const RentalChartRouter = express.Router();

  const rentalChartController = require('../../controllers/bmdashboard/bmRentalChartController')();

  RentalChartRouter.route('/rentalChart').get(rentalChartController.getAllRentalCosts);

  RentalChartRouter.route('/rentals/cost-over-time').get(
    rentalChartController.getRentalCostOverTime,
  );

  RentalChartRouter.route('/tools/cost-breakdown').get(rentalChartController.getToolsCostBreakdown);

  return RentalChartRouter;
};

module.exports = routes;
