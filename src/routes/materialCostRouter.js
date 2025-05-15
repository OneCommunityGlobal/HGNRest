// routes/materialCost.routes.js
const express = require('express');

module.exports = function () {
  // CALL the factory to get the handlers
  const controller = require('../controllers/materialCostController')();

  const router = express.Router();

  // If you want the list of projects:
  router.get('/totalProjects', controller.getProjects);

  // Material costs endpoint
  router.get('/material-costs', controller.getMaterialCosts);

  return router;
};
