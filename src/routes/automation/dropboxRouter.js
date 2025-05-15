const express = require('express');
const router = express.Router();
const githubController = require('../../controllers/automation/githubController');

// Route to send GitHub invitation
router.post('/invite', githubController.inviteUser);

// Route to remove a user from GitHub organization
router.delete('/remove', githubController.removeUser);

module.exports = router;
