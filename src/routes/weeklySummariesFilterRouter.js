const express = require('express');

module.exports = function () {
  // CALL the factory to get the handlers
  const controller = require('../controllers/weeklySummariesFilterController')();

  const router = express.Router();

  // If you want the list of projects:
  router.get('/weekly-summaries-filters', controller.getFilters);

  return router;
};
