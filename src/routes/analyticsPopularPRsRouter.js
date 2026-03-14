const express = require('express');

module.exports = function () {
  // CALL the factory to get the handlers
  const controller = require('../controllers/analyticsPopularPRsController')();

  const router = express.Router();

  // If you want the list of projects:
  router.get('/popular-prs', controller.getPopularPRs);

  return router;
};
