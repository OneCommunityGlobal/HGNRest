const express = require('express');

const routes = function () {
  const interactWithGPT = require('../controllers/aiGPTController');
  const gptrouter = express.Router();

  gptrouter.route('/interactWithGPT').post(interactWithGPT);

  return gptrouter;
};

module.exports = routes;
