const express = require('express');

const router = express.Router();

const emailOutboxController = require('../controllers/emailOutboxController');

router.get('/email-outbox', emailOutboxController.getEmails);
router.get('/email-outbox/:emailId', emailOutboxController.getEmailDetails);

module.exports = router;
