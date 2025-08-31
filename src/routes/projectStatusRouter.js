const express = require('express');

const router = express.Router();
const { fetchProjectStatus } = require('../controllers/projectStatus.controller');

//  Quick sanity check endpoint
router.get('/status', (req, res) => {
  console.log(' Project status route hit!');
  res.json({ message: ' projectStatus route is working!' });
});

// Main API endpoint
router.get('/summary', fetchProjectStatus);

// Export the router directly (not a function)
module.exports = router;
