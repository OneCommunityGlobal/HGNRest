const express = require('express');

module.exports = function () {
  const controller = require('../controllers/materialCostController')();
  const router = express.Router();
  router.get('/material-costs', controller.getMaterialCosts);
  return router;
};
