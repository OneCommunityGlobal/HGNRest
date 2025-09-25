const express = require('express');

module.exports = function () {
  // CALL the factory to get the handlers
  const controller = require('../controllers/weeklySummariesFilterController')();

  const router = express.Router();

  router.get('/weekly-summaries-filters', controller.getFilters);
  router.post('/weekly-summaries-filters', controller.createFilter);
  router.get('/weekly-summaries-filters/:id', controller.getFilterById);
  router.put('/weekly-summaries-filters/:id', controller.replaceFilter);
  router.patch('/weekly-summaries-filters/:id', controller.updateFilter);
  router.delete('/weekly-summaries-filters/:id', controller.deleteFilter);
  router.post(
    '/weekly-summaries-filters/replace-teamcode',
    controller.updateFiltersWithReplacedTeamCode,
  );

  return router;
};
