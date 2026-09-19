const express = require('express');

const router = express.Router();
const githubController = require('../../controllers/automation/githubController');

// Route to send GitHub invitation
router.post('/invite', githubController.inviteUser);

// Route to remove a user from GitHub organization
router.delete('/remove', githubController.removeUser);

// Route to get detailed user information
router.post('/user-details', githubController.getUserDetails);

// Route to get available teams
router.post('/teams', githubController.getTeams);

module.exports = router;
