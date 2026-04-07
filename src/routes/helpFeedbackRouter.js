const express = require('express');

const router = express.Router();
const {
  submitFeedback,
  closePermanently,
  deleteClosePermanently,
} = require('../controllers/helpFeedbackController');

// Temporarily bypass auth for testing
router.post('/submit', submitFeedback);
router.post('/close-permanently', closePermanently);
router.post('/delete-close-permanently', deleteClosePermanently);
module.exports = router;
