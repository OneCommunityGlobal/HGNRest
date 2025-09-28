/**
 * Simplified Email Batch Routes - Production Ready
 * Focus: Essential endpoints only
 */

const express = require('express');

const router = express.Router();
const emailBatchController = require('../controllers/emailBatchController');

// Batch management routes
router.get('/batches', emailBatchController.getBatches);
router.get('/batches/:batchId', emailBatchController.getBatchDetails);
router.get('/dashboard', emailBatchController.getDashboardStats);
router.get('/status', emailBatchController.getProcessorStatus);

// Retry operations
router.post('/retry-item/:itemId', emailBatchController.retryBatchItem);

module.exports = router;
