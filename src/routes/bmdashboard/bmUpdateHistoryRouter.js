const express = require('express');

const routes = function () {
  const updateHistoryRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmUpdateHistoryController')();

  // GET /api/bm/consumables/updateHistory
  updateHistoryRouter
    .route('/consumables/updateHistory')
    .get(controller.getConsumablesUpdateHistory);

  return updateHistoryRouter;
};

module.exports = routes;
