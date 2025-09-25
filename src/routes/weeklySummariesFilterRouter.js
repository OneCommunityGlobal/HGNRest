const express = require('express');

module.exports = function () {
  // CALL the factory to get the handlers
  const controller = require('../controllers/weeklySummariesFilterController')();

  const router = express.Router();

  router.get('/weeklySummariesFilters', controller.getFilters);
  router.post('/weeklySummariesFilters', controller.createFilter);
  router.get('/weeklySummariesFilters/:id', controller.getFilterById);
  router.put('/weeklySummariesFilters/:id', controller.replaceFilter);
  router.patch('/weeklySummariesFilters/:id', controller.updateFilter);
  router.delete('/weeklySummariesFilters/:id', controller.deleteFilter);
  router.post(
    '/weeklySummariesFilters/replaceTeamcodes',
    controller.updateFiltersWithReplacedTeamCode,
  );

  return router;
};
