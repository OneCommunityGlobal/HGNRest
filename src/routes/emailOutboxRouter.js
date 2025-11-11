const express = require('express');

const router = express.Router();

const emailOutboxController = require('../controllers/emailOutboxController');

// GET /api/email-outbox - Get all sent emails (outbox list)
router.get('/', emailOutboxController.getEmails);

// POST /api/email-outbox/:emailId/retry - Retry failed email batches
router.post('/:emailId/retry', emailOutboxController.retryEmail);

// GET /api/email-outbox/:emailId - Get email details with batches
router.get('/:emailId', emailOutboxController.getEmailDetails);

module.exports = router;
