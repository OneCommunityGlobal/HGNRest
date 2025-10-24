const express = require('express');

const slackController = require('../../controllers/automation/slackController');
const router = express.Router();

// Route to invite a user to Slack
router.post('/invite', slackController.inviteUser);

module.exports = router;