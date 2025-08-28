const express = require('express');
const dropboxController = require('../../controllers/automation/dropboxController');

const router = express.Router();

// Routes for Dropbox actions
router.post('/create-folder', dropboxController.createFolder);
router.post('/invite', dropboxController.inviteUserToFolder);
router.post('/create-folder-and-invite', dropboxController.createFolderAndInvite);
router.delete('/delete-folder', dropboxController.deleteFolder);
router.get('/team-folders', dropboxController.getTeamFolders);

module.exports = router;
