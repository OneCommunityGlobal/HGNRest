const express = require('express');
const dropboxController = require('../../controllers/automation/dropboxController');

const router = express.Router();

// Routes for Dropbox actions
router.post('/create-folder', dropboxController.createFolder);
router.post('/invite-user', dropboxController.inviteUserToFolder);
router.post('/delete-folder', dropboxController.deleteFolder);

module.exports = router;