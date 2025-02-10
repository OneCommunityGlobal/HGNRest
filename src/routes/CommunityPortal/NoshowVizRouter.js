const express = require('express');

const routes = function () {
  const noShowRouter = express.Router();
  const controller = require('../../controllers/CommunityPortal/NoshowVizController')(); // Import the controller
  console.log(controller);

  // Route for getting no shows data by period (e.g., year, month)
  noShowRouter.route('/no-shows/data')
    .get(controller.getNoShowsData);

  // Route for getting no shows by location
  noShowRouter.route('/no-shows/location')
    .get(controller.getNoShowsByLocation);

  // Route for getting no shows by age group
  noShowRouter.route('/no-shows/age-group')
    .get(controller.getNoShowsByAgeGroup);

  // Route for getting no shows by gender (example)
  noShowRouter.route('/no-shows/proportions')
    .get(controller.getNoShowProportions);

  noShowRouter.route('/no-shows/unique-eventTypes')
    .get(controller.getUniqueEventTypes);

  // Route for getting attendance by day
  noShowRouter.route('/attendance/by-day')
    .get(controller.getAttendanceByDay);

  return noShowRouter;
};

module.exports = routes;
