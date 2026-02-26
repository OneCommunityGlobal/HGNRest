// summaryDashboard.routes.js
const express = require('express');

const router = express.Router();
const summaryDashboardController = require('../controllers/summaryDashboard.controller');

// Metrics
router.get('/metrics', summaryDashboardController.getMetrics);

// Material costs
router.get('/materials/costs', summaryDashboardController.getMaterialCosts);

// Force refresh snapshot
// router.post('/metrics/refresh', summaryDashboardController.refreshMetrics);

// History of a metric
router.get('/metrics/history', summaryDashboardController.getHistory);

module.exports = router;
