const express = require('express');

const routes = function () {
  const controller = require('../controllers/studentEvaluationResultsController')();
  const router = express.Router();

  router.route('/student/evaluation-results').get(controller.getEvaluationResults);
  router
    .route('/student/evaluation-results/notifications')
    .get(controller.getEvaluationResultNotifications);

  return router;
};

module.exports = routes;
