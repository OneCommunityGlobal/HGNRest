const dropboxService = require('../../services/automation/dropboxService');
const UserProfile = require('../../models/userProfile');
const ApplicationAccess = require('../../models/applicationAccess');
const appAccessService = require('../../services/automation/appAccessService');
const { checkAppAccess } = require('./utils');

// Create a new folder and a "Week 1" subfolder
async function createFolder(req, res) {
  return res.status(501).json({ message: 'Not yet implemented' });
}

async function createFolderAndInvite(req, res) {
  try {
    const { requestor, folderPath, targetUser, teamFolderKey } = req.body;

    if (!(await checkAppAccess(requestor))) {
      return res.status(403).json({ message: 'Unauthorized request' });
    }

    // Validate required fields
    if (!folderPath || !targetUser?.targetUserId) {
      return res
        .status(400)
        .json({ message: 'User folder name and target user information are required' });
    }

    // Validate teamFolderKey if provided
    if (
      teamFolderKey &&
      !dropboxService.getAvailableTeamFolders().find((folder) => folder.key === teamFolderKey)
    ) {
      return res.status(400).json({ message: 'Invalid teamFolderKey provided' });
    }

    const user = await UserProfile.findById(targetUser.targetUserId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const result = await dropboxService.createFolderAndInvite(
      targetUser.email,
      folderPath,
      teamFolderKey,
    );

    // Store just the folder_id as credentials (most reliable identifier)
    await appAccessService.upsertAppAccess(
      targetUser.targetUserId,
      'dropbox',
      'invited',
      result.folderId,
    );

    res.status(200).json({
      message: 'User invited successfully to Dropbox folder',
      folderPath: result.folderPath,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Invite a user to a Dropbox folder
async function inviteUserToFolder(req, res) {
  return res.status(501).json({ message: 'Not yet implemented' });
}

// Delete a folder
async function deleteFolder(req, res) {
  try {
    const { requestor, targetUser } = req.body;

    if (!(await checkAppAccess(requestor))) {
      return res.status(403).json({ message: 'Unauthorized request' });
    }

    const appAccess = await ApplicationAccess.findOne({ userId: targetUser.targetUserId });
    const dropboxApp = appAccess && appAccess.apps.find((app) => app.app === 'dropbox');

    if (!dropboxApp || !dropboxApp.credentials) {
      return res
        .status(404)
        .json({ message: 'Dropbox folder information not found for this user.' });
    }

    await dropboxService.deleteFolder(dropboxApp.credentials);
    await appAccessService.revokeAppAccess(targetUser.targetUserId, 'dropbox');

    res.status(200).json({ message: 'User Dropbox folder deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Get available Dropbox team folders
async function getTeamFolders(req, res) {
  try {
    const teamFolders = dropboxService.getAvailableTeamFolders();
    res.status(200).json(teamFolders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  createFolder,
  createFolderAndInvite,
  inviteUserToFolder,
  deleteFolder,
  getTeamFolders,
};
