const express = require('express');

const router = express.Router();
const chatGPTController = require('../controllers/chatGPTController');

// Define a route for generating a summary
router.post('/generateSummary', chatGPTController.generateSummary);

module.exports = router;
