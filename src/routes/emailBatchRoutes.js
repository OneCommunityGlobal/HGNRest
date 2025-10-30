const express = require('express');

const router = express.Router();

const emailBatchController = require('../controllers/emailBatchController');

router.get('/emails', emailBatchController.getEmails);
router.get('/emails/:emailId', emailBatchController.getEmailDetails);

router.get('/worker-status', emailBatchController.getWorkerStatus);

router.post('/emails/:emailId/retry', emailBatchController.retryEmail);

router.get('/audit/email/:emailId', emailBatchController.getEmailAuditTrail);
router.get('/audit/email-batch/:emailBatchId', emailBatchController.getEmailBatchAuditTrail);

module.exports = router;
