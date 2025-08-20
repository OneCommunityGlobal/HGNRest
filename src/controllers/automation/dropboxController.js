const dropboxService = require('../../services/automation/dropboxService');
const UserProfile = require('../../models/userProfile');
const ApplicationAccess = require('../../models/applicationAccess');
const appAccessService = require('../../services/automation/appAccessService');
const { checkAppAccess } = require('./utils');

// Create a new folder and a "Week 1" subfolder
async function createFolder(req, res) {
  try {
    const { folderName } = req.body;
    const { parentFolderResponse, subfolderResponse } =
      await dropboxService.createFolderWithSubfolder(folderName);
    const { requestor } = req.body;
    if (!checkAppAccess(requestor.role)) {
      res.status(403).send({ message: 'Unauthorized request' });
      return;
    }

    res.status(201).json({
      message: 'Folder and subfolder created successfully!',
      parentFolder: parentFolderResponse,
      subfolder: subfolderResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function createFolderAndInvite(req, res) {
  try {
    const { requestor, folderPath, targetUser, teamFolderKey } = req.body;

    if (!checkAppAccess(requestor.role)) {
      res.status(403).send({ message: 'Unauthorized request' });
      return;
    }

    // Validate required fields
    if (!folderPath || !targetUser?.targetUserId) {
      return res
        .status(400)
        .json({ message: 'folderPath and targetUser.targetUserId are required' });
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
      message: 'User invited successfully',
      folderPath: result.folderPath,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Invite a user to a Dropbox folder
async function inviteUserToFolder(req, res) {
  try {
    const { userId, folderPath, teamFolderKey } = req.body;
    const user = await UserProfile.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const result = await dropboxService.inviteUserToFolder(user.email, folderPath, teamFolderKey);
    await appAccessService.upsertAppAccess(userId, 'dropbox', 'invited', result.folderId);
    const { requestor } = req.body;
    if (!checkAppAccess(requestor.role)) {
      res.status(403).send({ message: 'Unauthorized request' });
      return;
    }
    res.status(200).json({ message: 'User invited successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Delete a folder
async function deleteFolder(req, res) {
  try {
    const { requestor, targetUser } = req.body;

    if (!checkAppAccess(requestor.role)) {
      res.status(403).send({ message: 'Unauthorized request' });
      return;
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

    res.status(200).json({ message: 'Folder deleted successfully' });
  } catch (error) {
    // console.log(error);
    res.status(500).json({ message: error.message });
  }
}

// Get available team folders
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
