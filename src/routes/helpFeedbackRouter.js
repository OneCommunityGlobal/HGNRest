const express = require('express');

const router = express.Router();
const { submitFeedback, closePermanently } = require('../controllers/helpFeedbackController');

// Temporarily bypass auth for testing
router.post('/submit', submitFeedback);
router.post('/close-permanently', closePermanently);

module.exports = router;
