const express = require('express');
const { getPRReviewInsights, postPRReviewInsights } = require('../../controllers/prAnalytics/prInsightsController');

const router = express.Router();

router.get('/analytics/pr-review-insights', getPRReviewInsights);
router.post('/analytics/pr-review-insights', postPRReviewInsights);

module.exports = router;