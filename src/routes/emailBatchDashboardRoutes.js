/**
 * Simplified Email Batch Dashboard Routes - Production Ready
 * Focus: Essential dashboard endpoints only
 */

const express = require('express');

const router = express.Router();
const emailBatchDashboardController = require('../controllers/emailBatchDashboardController');

// Dashboard routes
router.get('/dashboard', emailBatchDashboardController.getDashboardStats);

module.exports = router;
