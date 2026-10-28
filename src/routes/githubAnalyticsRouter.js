const express = require('express');
const { getGitHubReviews } = require('../controllers/githubAnalyticsController');

const router = express.Router();

router.get('/github-reviews', getGitHubReviews);
router.get('/review-summary', getGitHubReviews);

module.exports = router;
