const express = require('express');

const route = function () {
  const controller = require('../controllers/reportsController.js')();

  const reportsRouter = express.Router();

  reportsRouter.route('/reports/weeklysummary')
    .get(controller.getWeeklySummaries);

  return reportsRouter;
};

module.exports = route;
