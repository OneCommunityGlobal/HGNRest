const dropboxService = require('../../services/automation/dropboxService');
const UserProfile = require('../../models/userProfile');
const appAccessService = require('../../services/automation/appAccessService');
const { checkAppAccess } = require('./utils');

// Create a new folder and a "Week 1" subfolder
async function createFolder(req, res) {
  return res.status(501).json({ message: 'Not yet implemented' });
}

async function createFolderAndInvite(req, res) {
  const { requestor, folderPath, targetUser, teamFolderKey } = req.body;

  if (!checkAppAccess(requestor.role)) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  // Validate required fields
  if (!folderPath || !targetUser?.targetUserId) {
    return res.status(400).json({
      message: 'User folder name and target user information are required',
    });
  }

  if (!targetUser?.email) {
    return res.status(400).json({ message: 'User email is required' });
  }

  // Validate teamFolderKey if provided
  if (
    teamFolderKey &&
    !dropboxService.getAvailableTeamFolders().find((folder) => folder.key === teamFolderKey)
  ) {
    return res.status(400).json({ message: 'Invalid teamFolderKey provided' });
  }

  try {
    const user = await UserProfile.findById(targetUser.targetUserId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // First, create Dropbox folder and invite user
    const result = await dropboxService.createFolderAndInvite(
      targetUser.email,
      folderPath,
      teamFolderKey,
    );

    // Only update database if Dropbox operation was successful
    try {
      await appAccessService.upsertAppAccess(
        targetUser.targetUserId,
        'dropbox',
        'invited',
        result.folderId,
      );

      return res.status(201).json({
        message: 'User invited successfully to Dropbox folder',
        data: {
          folderPath: result.folderPath,
          folderId: result.folderId,
          folderName: result.folderName,
          userId: targetUser.targetUserId,
        },
      });
    } catch (dbError) {
      // Rollback: attempt to delete the Dropbox folder if DB update fails
      try {
        await dropboxService.deleteFolder(result.folderId);
      } catch (rollbackError) {
        // Log rollback failure but don't throw - we want to report the original DB error
        console.error('Failed to rollback Dropbox folder creation:', rollbackError.message);
      }
      const dbUpdateError = new Error(
        `Database update failed after successful Dropbox folder creation: ${dbError.message}`,
      );
      dbUpdateError.name = 'DatabaseError';
      dbUpdateError.statusCode = 500;
      throw dbUpdateError;
    }
  } catch (error) {
    // Use the error's statusCode if available, otherwise default to 500
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  }
}

// Invite a user to a Dropbox folder
async function inviteUserToFolder(req, res) {
  return res.status(501).json({ message: 'Not yet implemented' });
}

// Delete a folder
async function deleteFolder(req, res) {
  const { requestor, targetUser } = req.body;

  if (!targetUser?.targetUserId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  if (!requestor?.role) {
    return res.status(400).json({ message: 'Requestor role is required' });
  }

  if (!checkAppAccess(requestor.role)) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  try {
    // Step 1: Get the stored folder ID from database
    let folderIdToUse;
    try {
      folderIdToUse = await appAccessService.getAppCredentials(targetUser.targetUserId, 'dropbox');
    } catch (credentialError) {
      throw new Error('Dropbox access not found for this user. They may not have been invited.');
    }

    // Step 2: Delete from Dropbox using the folder ID
    const result = await dropboxService.deleteFolder(folderIdToUse);

    // Step 3: Only update internal records if Dropbox operation succeeded
    try {
      await appAccessService.revokeAppAccess(targetUser.targetUserId, 'dropbox');
    } catch (dbError) {
      const dbUpdateError = new Error(`Database update failed: ${dbError.message}`);
      dbUpdateError.name = 'DatabaseError';
      dbUpdateError.statusCode = 500;
      throw dbUpdateError;
    }

    return res.status(200).json({
      message: result.message,
      data: {
        folderId: folderIdToUse,
        userId: targetUser.targetUserId,
        method: result.method,
      },
    });
  } catch (error) {
    // Use the error's statusCode if available, otherwise default to 500
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  }
}

// Get available Dropbox team folders
async function getTeamFolders(req, res) {
  try {
    const teamFolders = dropboxService.getAvailableTeamFolders();
    res.status(200).json(teamFolders);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  createFolder,
  createFolderAndInvite,
  inviteUserToFolder,
  deleteFolder,
  getTeamFolders,
};
