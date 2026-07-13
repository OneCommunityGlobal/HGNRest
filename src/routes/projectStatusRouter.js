const express = require('express');
const projectStatusController = require('../controllers/projectStatusController');

module.exports = function () {
  const router = express.Router();

  router.get('/status', projectStatusController.getProjectStatusSummary);

  return router;
};
