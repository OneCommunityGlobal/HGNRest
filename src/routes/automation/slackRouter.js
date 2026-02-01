/* eslint-disable import/order */
const express = require('express');
// eslint-disable-next-line no-unused-vars
const slackController = require('../../controllers/automation/slackController');

const router = express.Router();
const sentryController = require('../../controllers/automation/sentryController');

// Route to send invitation to a user
router.post('/invite', sentryController.inviteUser);

// Route to remove a user from the organization
router.delete('/remove', sentryController.removeUser);

module.exports = router;
