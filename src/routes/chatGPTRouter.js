const express = require('express');

const router = express.Router();
const chatGPTController = require('../controllers/chatGPTController');

// Define a route for generating a summary
router.get('/interactWithChatGPT', chatGPTController.interactWithChatGPT);

module.exports = router;
