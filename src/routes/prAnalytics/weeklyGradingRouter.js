const express = require('express');

const routes = function (weeklyGradingModel) {
  const weeklyGradingRouter = express.Router();
  const controller = require('../../controllers/prAnalytics/weeklyGradingController')(
    weeklyGradingModel,
  );

  weeklyGradingRouter.route('/weekly-grading').get(controller.getWeeklyGrading);
  weeklyGradingRouter.route('/weekly-grading/save').post(controller.saveWeeklyGrading);
  weeklyGradingRouter.route('/weekly-grading/reviewer').delete(controller.deleteReviewerGrading);

  return weeklyGradingRouter;
};

module.exports = routes;
