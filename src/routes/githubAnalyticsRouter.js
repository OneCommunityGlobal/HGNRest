const express = require('express');
const router = express.Router();
const { getGitHubReviews } = require('../controllers/githubAnalyticsController');

router.get('/github-reviews', getGitHubReviews);

module.exports = router;
