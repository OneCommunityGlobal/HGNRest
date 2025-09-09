const dropboxService = require('../../services/automation/dropboxService');
const UserProfile = require('../../models/userProfile');
const ApplicationAccess = require('../../models/applicationAccess');
const appAccessService = require('../../services/automation/appAccessService');
const { checkAppAccess } = require('./utils');

// Create a new folder and a "Week 1" subfolder
async function createFolder(req, res) {
  try {
    const { folderName } = req.body;
    const { parentFolderResponse, subfolderResponse } = await dropboxService.createFolderWithSubfolder(folderName);
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
    const { requestor, folderPath, targetUser } = req.body;

    if (!checkAppAccess(requestor.role)) {
      res.status(403).send({ message: 'Unauthorized request' });
      return;
    } 
    const user = await UserProfile.findById(targetUser.targetUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await dropboxService.createFolderAndInvite(targetUser.email, folderPath);

    await appAccessService.upsertAppAccess(targetUser.targetUserId, 'dropbox', 'invited', targetUser.email);
    res.status(200).json({ message: 'User invited successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Invite a user to a Dropbox folder
async function inviteUserToFolder(req, res) {
  try {
    const { userId, folderPath } = req.body;
    const user = await UserProfile.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await dropboxService.inviteUserToFolder(user.email, folderPath);
    await appAccessService.upsertAppAccess(userId, 'dropbox', 'invited', folderPath);
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
    const { requestor, folderPath, targetUser } = req.body;

    if (!checkAppAccess(requestor.role)) {
      res.status(403).send({ message: 'Unauthorized request' });
      return;
    }

    const appAccess = await ApplicationAccess.findOne({ userId: targetUser.targetUserId });
    const dropboxApp = appAccess && appAccess.apps.find((app) => app.app === 'dropbox');

    if (!dropboxApp || !dropboxApp.credentials) {
      return res.status(404).json({ message: 'Dropbox folder information not found for this user.' });
    }

    await dropboxService.deleteFolder(folderPath);
    await appAccessService.revokeAppAccess(targetUser.targetUserId, 'dropbox');

    res.status(200).json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  createFolder,
  createFolderAndInvite,
  inviteUserToFolder,
  deleteFolder,
};