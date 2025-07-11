const express = require('express');
const { getHoursPledged } = require('../../controllers/jobAnalytics/hoursPledgedController');

const router = express.Router();

// Define the endpoint
router.get('/analytics/hours-pledged', getHoursPledged);

module.exports = router;