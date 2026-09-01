const express = require('express');
const { fetchProjectStatus } = require('../controllers/projectStatus.controller');

module.exports = function () {
  const router = express.Router();

  router.get('/summary', fetchProjectStatus);

  return router;
};
