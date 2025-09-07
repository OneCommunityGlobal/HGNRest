const express = require('express');

const routes = function () {
  // initialize routes
  const RentalChartRouter = express.Router();
  console.log('making router');
  const rentalChartController = require('../../controllers/bmdashboard/bmRentalChartController')();

  RentalChartRouter.route('/rentalChart').get(rentalChartController.getAllRentalCosts);

  return RentalChartRouter;
};

module.exports = routes;
