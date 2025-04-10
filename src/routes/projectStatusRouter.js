const express = require('express');
const router = express.Router();
const { getProjectStatusSummary } = require('../controllers/projectStatusController');
const projectStatusRateLimiter = require('../utilities/rateLimiter');


// Define GET endpoint for project status summary
router.get('/status', projectStatusRateLimiter, getProjectStatusSummary);

module.exports = router;
