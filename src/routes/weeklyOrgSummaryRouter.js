const express = require('express');

const route = function () {
  const controller = require('../controllers/weeklyOrgSummaryController')();

  const weeklyOrgSummaryRouter = express.Router();

  weeklyOrgSummaryRouter.route('/reports/orgsummaryemail/status').get(controller.getStatus);
  weeklyOrgSummaryRouter.route('/reports/orgsummaryemail/settings').put(controller.updateSettings);
  weeklyOrgSummaryRouter.route('/reports/orgsummaryemail/send').post(controller.sendNow);

  return weeklyOrgSummaryRouter;
};

module.exports = route;
