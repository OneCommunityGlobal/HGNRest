const express = require('express');

const route = function () {
  const controller = require('../controllers/reportsController.js')();

  const reportsRouter = express.Router();

  reportsRouter.route('/reports/weeklysummaries')
    .get(controller.getWeeklySummaries);

  return reportsRouter;
};

module.exports = route;
