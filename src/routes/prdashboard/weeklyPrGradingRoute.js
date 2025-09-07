const express = require('express');

const routes = function (prGrading) {
  const WeeklyPrGradingRouter = express.Router();
  const controller = require('../../controllers/prdashboard/weeklyPrGradingController')(prGrading);

  WeeklyPrGradingRouter.route('/weekly-grading/:team').get(controller.getWeeklyPrGrading);
  WeeklyPrGradingRouter.route('/weekly-grading/save').post(controller.postWeeklyPrGrading);

  return WeeklyPrGradingRouter;
};

module.exports = routes;
