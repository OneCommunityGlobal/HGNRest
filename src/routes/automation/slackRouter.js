// routes/slackRoutes.js
const express = require('express');
const router = express.Router();
const slackController = require('../../controllers/automation/slackController');

// Route to invite a user to Slack
router.post('/send-invite', slackController.inviteUser);

module.exports = router;