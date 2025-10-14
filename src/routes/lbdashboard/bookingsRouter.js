const express = require('express');

const router = express.Router();

// Temporary route setup for testing API registration
router.get('/status', (req, res) => {
  res.status(200).json({
    message: 'Booking payment routes working (WIP)',
    author: 'Adithya Cherukuri',
  });
});

module.exports = router;
