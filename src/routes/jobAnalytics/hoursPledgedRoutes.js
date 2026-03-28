const express = require('express');
const hoursPledgedController = require('../../controllers/jobAnalytics/hoursPledgedController')();

const router = express.Router();

// Define the endpoints
router.route('/analytics/hours-pledged').get(hoursPledgedController.getHoursPledged);
router.route('/analytics/hours-pledged').post(hoursPledgedController.addHoursPledged);

module.exports = router;
