const express = require('express');

const routes = function () {
  const noShowRouter = express.Router();
  const controller = require('../../controllers/CommunityPortal/NoshowVizController')(); // Import the controller
  console.log(controller);

  // Route for getting no shows data by period (e.g., year, month)
  noShowRouter.route('/data')
    .get(controller.getNoShowsData);

  // Route for getting no shows by location
  noShowRouter.route('/location')
    .get(controller.getNoShowsByLocation);

  // Route for getting no shows by age group
  noShowRouter.route('/age-group')
    .get(controller.getNoShowsByAgeGroup);

  // Route for getting no shows by gender (example)
  noShowRouter.route('/proportions')
    .get(controller.getNoShowProportions);

  noShowRouter.route('/unique-eventTypes')
    .get(controller.getUniqueEventTypes);

  // Route for getting attendance by day
  noShowRouter.route('/by-day')
    .get(controller.getAttendanceByDay);

  return noShowRouter;
};

module.exports = routes;
