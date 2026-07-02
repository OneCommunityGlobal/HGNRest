const express = require('express');

module.exports = function () {
  const controller = require('../controllers/ownerMessageLogController')();

  const router = express.Router();

  router.get('/ownerMessageLogs', controller.getOwnerMessageLogs);

  return router;
};
