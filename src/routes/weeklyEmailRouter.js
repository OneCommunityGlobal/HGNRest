const express = require('express');

const routes = function () {
  const weeklyEmailRouter = express.Router();
  const controller = require('../controllers/weeklyEmailController')();

  // Manual send weekly summaries email
  weeklyEmailRouter.post('/weekly-summaries/send', controller.sendWeeklySummariesEmail);

  return weeklyEmailRouter;
};

module.exports = routes;
