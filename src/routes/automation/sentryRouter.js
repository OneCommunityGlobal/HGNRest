const express = require('express');
const router = express.Router();
const sentryController = require('../../controllers/automation/sentryController');

// Route to send invitation to a user
router.post('/invite', sentryController.inviteUser);

// Route to remove a user from the organization
router.delete('/remove', sentryController.removeUser);

module.exports = router;
