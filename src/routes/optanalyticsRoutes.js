const express = require('express');

module.exports = function () {
  const router = express.Router();
  const optAnalyticsController = require('../controllers/optAnalyticsController')();
  router.get('/opt-status', optAnalyticsController.getOPTStatusBreakdown);

  return router;
};
