const dropboxService = require('../../services/automation/dropboxService');
const UserProfile = require('../../models/userProfile');
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
  const { requestor, folderName, targetUser, teamFolderKey } = req.body;

  if (!(await checkAppAccess(requestor))) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  // Validate required fields
  if (!folderName || !targetUser?.targetUserId) {
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
      folderName,
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
  const { requestor, targetUser } = req.body;

  if (!targetUser?.targetUserId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  if (!requestor) {
    return res.status(400).json({ message: 'Requestor is required' });
  }

  if (!(await checkAppAccess(requestor))) {
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

// Get detailed folder information from Dropbox
async function getFolderDetails(req, res) {
  const { targetUser, requestor } = req.body;

  // 1. Authorization check
  if (!requestor) {
    return res.status(400).json({ message: 'Requestor is required' });
  }

  if (!(await checkAppAccess(requestor))) {
    return res.status(403).json({ message: 'Unauthorized request' });
  }

  if (!targetUser?.targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required' });
  }

  try {
    // 2. Database validation - get actual credentials and verify access
    let appAccess;
    try {
      appAccess = await appAccessService.getAppAccess(targetUser.targetUserId, 'dropbox');
    } catch (error) {
      return res.status(404).json({
        message: 'No Dropbox access found for this user. They may not have been invited.',
      });
    }

    // 3. Status validation - only allow invited apps
    if (appAccess.status !== 'invited') {
      return res.status(403).json({
        message: `Cannot view details for ${appAccess.status} Dropbox access. Only invited access can be viewed.`,
      });
    }

    // 4. Use verified credentials from database
    const verifiedFolderId = appAccess.credentials;
    const folderDetails = await dropboxService.getFolderDetails(verifiedFolderId);

    // Return minimal essential details only
    const essentialDetails = {
      'Folder ID': verifiedFolderId,
      'Folder Name': folderDetails.folderName,
      'Folder Path': folderDetails.folderPath,
      'Team Folder': folderDetails.teamFolder,
      Subfolders:
        folderDetails.subfolders && folderDetails.subfolders.length > 0
          ? folderDetails.subfolders.join(', ')
          : 'No subfolders',
      Members:
        folderDetails.sharedMembers && folderDetails.sharedMembers.length > 0
          ? folderDetails.sharedMembers
              .map((member) => `${member.email} (${member.role})`)
              .join(', ')
          : 'No members found',
    };

    return res.status(200).json({
      message: 'Dropbox folder details retrieved successfully',
      data: essentialDetails,
    });
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
  getFolderDetails,
};
