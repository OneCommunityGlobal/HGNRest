const express = require('express');

module.exports = function () {
  console.log('in opt analytics routes');
  const router = express.Router();
  const optAnalyticsController = require('../controllers/optAnalyticsController')();
  router.get('/opt-status', optAnalyticsController.getOPTStatusBreakdown);

  return router;
};
