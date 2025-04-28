const express = require('express');
const router = express.Router();
const { getActualCostBreakdown } = require('../controllers/actualCostBreakdownController');

// Endpoint
router.get('/api/projects/:id/actual-cost-breakdown', getActualCostBreakdown);

module.exports = router;
