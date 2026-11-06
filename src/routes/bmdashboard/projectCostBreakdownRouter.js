const express = require('express');
const controller = require('../../controllers/bmdashboard/bmExpenditureController');

const routes = function () {
  const router = express.Router();

  router.get('/with-expenditure', controller.getProjectIdsWithExpenditure);
  router.get('/:id/cost-breakdown', controller.getCostBreakdown);

  return router;
};

module.exports = routes;
