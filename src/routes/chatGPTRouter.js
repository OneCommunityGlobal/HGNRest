const express = require('express');


const routes = function () {
  const interactWithChatGPT = require('../controllers/chatGPTController');
  const chatgptrouter = express.Router();

  chatgptrouter.route('/interactWithChatGPT').post(interactWithChatGPT);

  return chatgptrouter;
};

module.exports = routes;
