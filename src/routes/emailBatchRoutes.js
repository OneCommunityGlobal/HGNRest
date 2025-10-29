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

// Audit operations
router.get('/audit/email/:emailId', emailBatchController.getEmailAuditTrail);
router.get('/audit/email-batch/:emailBatchId', emailBatchController.getEmailBatchAuditTrail);
router.get('/audit/stats', emailBatchController.getAuditStats);

module.exports = router;
