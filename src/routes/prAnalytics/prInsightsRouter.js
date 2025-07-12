const express = require('express');
const { getPRReviewInsights } = require('../../controllers/prAnalytics/prInsightsController');

const router = express.Router();

router.get('/analytics/pr-review-insights', getPRReviewInsights);

module.exports = router;