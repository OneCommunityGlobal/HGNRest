/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch');
require('dotenv').config();

// Initialize Dropbox client
const dbx = new Dropbox({
  clientId: process.env.DROPBOX_CLIENT_ID,
  clientSecret: process.env.DROPBOX_CLIENT_SECRET,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
  fetch,
});

// Dropbox team folder configuration - easy to extend for future folders
const TEAM_FOLDERS = {
  HGN: '_Highest Good Network Team',
  ADMIN: '_Administration Team',
};

const DEFAULT_TEAM_FOLDER = 'HGN';

/**
 * Get Dropbox team folder path by key
 */
function getTeamFolderPath(teamFolderKey = DEFAULT_TEAM_FOLDER) {
  // Input validation
  if (!teamFolderKey || typeof teamFolderKey !== 'string' || teamFolderKey.trim().length === 0) {
    throw new Error('Team folder key is required and must be a non-empty string');
  }

  const folderName = TEAM_FOLDERS[teamFolderKey];
  if (!folderName) {
    throw new Error(`Invalid Dropbox team folder key: ${teamFolderKey}`);
  }
  return `/${folderName}`;
}

/**
 * Get available Dropbox team folders for frontend
 */
function getAvailableTeamFolders() {
  return Object.entries(TEAM_FOLDERS).map(([key, name]) => ({
    key,
    name: name.replace(/^_/, ''), // Remove leading underscore for display
    isDefault: key === DEFAULT_TEAM_FOLDER,
  }));
}

/**
 * Ensure a folder exists at the given path. Creates if missing.
 */
async function ensureFolderExists(path) {
  // Input validation
  if (!path || typeof path !== 'string' || path.trim().length === 0) {
    throw new Error('Path is required and must be a non-empty string');
  }

  // Validate path format (must start with /)
  if (!path.startsWith('/')) {
    throw new Error('Path must start with /');
  }

  try {
    await dbx.filesGetMetadata({ path });
  } catch (err) {
    if (err.status === 409 && err.error?.error?.['.tag'] === 'path') {
      await dbx.filesCreateFolderV2({ path });
    } else {
      throw err;
    }
  }
}

/**
 * Polls an async share-folder job until complete, using the correct endpoint.
 */
async function waitForShareCompletion(asyncJobId, maxAttempts = 10) {
  // Input validation
  if (!asyncJobId || typeof asyncJobId !== 'string' || asyncJobId.trim().length === 0) {
    throw new Error('Async job ID is required and must be a non-empty string');
  }

  if (maxAttempts && (typeof maxAttempts !== 'number' || maxAttempts <= 0)) {
    throw new Error('Max attempts must be a positive number');
  }

  let attempts = 0;
  // eslint-disable-next-line no-await-in-loop
  while (attempts < maxAttempts) {
    // eslint-disable-next-line no-await-in-loop
    const status = await dbx.sharingCheckShareJobStatus({ async_job_id: asyncJobId.trim() });
    const tag = status.result['.tag'];

    if (tag === 'complete') {
      return status.result;
    }
    if (tag === 'failed') {
      throw new Error(`Share job failed: ${JSON.stringify(status.result.failed)}`);
    }
    // in_progress
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => {
      setTimeout(res, 1000);
    });
    attempts += 1;
  }
  throw new Error('Timeout waiting for share to complete');
}

/**
 * Creates a new user folder under the specified Dropbox team folder and a 'Week 1' subfolder.
 * Throws if the user folder already exists.
 */
async function createFolderWithSubfolder(userFolderName, teamFolderKey = DEFAULT_TEAM_FOLDER) {
  // Input validation
  if (!userFolderName || typeof userFolderName !== 'string' || userFolderName.trim().length === 0) {
    throw new Error('User folder name is required and must be a non-empty string');
  }

  if (!teamFolderKey || typeof teamFolderKey !== 'string' || teamFolderKey.trim().length === 0) {
    throw new Error('Team folder key is required and must be a non-empty string');
  }

  // Validate team folder key
  if (!TEAM_FOLDERS[teamFolderKey]) {
    throw new Error(`Invalid team folder key: ${teamFolderKey}`);
  }

  // Sanitize user folder name (remove special characters that could cause issues)
  const sanitizedUserFolderName = userFolderName.trim().replace(/[<>:"/\\|?*]/g, '_');

  const teamFolderPath = getTeamFolderPath(teamFolderKey);
  const userFolderPath = `${teamFolderPath}/${sanitizedUserFolderName}`;

  // Ensure team folder exists
  await ensureFolderExists(teamFolderPath);

  // Check if user folder already exists
  try {
    await dbx.filesGetMetadata({ path: userFolderPath });
    throw new Error(`User folder '${userFolderPath}' already exists`);
  } catch (err) {
    if (err.status === 409 && err.error?.error?.['.tag'] === 'path') {
      // Not found, create user folder and Week 1 subfolder
      await dbx.filesCreateFolderV2({ path: userFolderPath });
      await dbx.filesCreateFolderV2({ path: `${userFolderPath}/Week 1` });
      return userFolderPath;
    }
    throw err;
  }
}

/**
 * Creates a user folder, shares it, and invites a user.
 * Throws if any step fails.
 */
async function createFolderAndInvite(email, userFolderName, teamFolderKey = DEFAULT_TEAM_FOLDER) {
  // Input validation
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    throw new Error('Email is required and must be a non-empty string');
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new Error('Invalid email format');
  }

  if (!userFolderName || typeof userFolderName !== 'string' || userFolderName.trim().length === 0) {
    throw new Error('User folder name is required and must be a non-empty string');
  }

  if (!teamFolderKey || typeof teamFolderKey !== 'string' || teamFolderKey.trim().length === 0) {
    throw new Error('Team folder key is required and must be a non-empty string');
  }

  // Validate team folder key
  if (!TEAM_FOLDERS[teamFolderKey]) {
    throw new Error(`Invalid team folder key: ${teamFolderKey}`);
  }

  let userFolderPath;
  try {
    // 1. Create user folder and Week 1 subfolder
    userFolderPath = await createFolderWithSubfolder(userFolderName, teamFolderKey);

    // 2. Initiate share
    const shareResult = await dbx.sharingShareFolder({ path: userFolderPath });
    let folderMeta;

    if (shareResult.result['.tag'] === 'async_job_id') {
      folderMeta = await waitForShareCompletion(shareResult.result.async_job_id);
    } else if (shareResult.result['.tag'] === 'complete') {
      folderMeta = shareResult.result;
    } else {
      throw new Error(`Unexpected share tag: ${shareResult.result['.tag']}`);
    }

    const sharedFolderId = folderMeta.shared_folder_id;
    if (!sharedFolderId) {
      throw new Error('Missing shared_folder_id in share response');
    }

    // 3. Invite user
    const inviteResponse = await dbx.sharingAddFolderMember({
      shared_folder_id: sharedFolderId,
      members: [
        { member: { '.tag': 'email', email: email.trim() }, access_level: { '.tag': 'editor' } },
      ],
      quiet: false,
    });

    // Get the folder metadata to retrieve the folder_id
    const folderMetadata = await dbx.filesGetMetadata({ path: userFolderPath });

    return {
      inviteResponse,
      folderPath: userFolderPath,
      sharedFolderId,
      folderId: folderMetadata.result.id,
      folderName: userFolderName,
    };
  } catch (err) {
    if (userFolderPath) {
      // Try to clean up the created user folder
      try {
        await dbx.filesDeleteV2({ path: userFolderPath });
      } catch (cleanupErr) {
        // Log cleanup error but don't throw it
        console.error('Failed to cleanup user folder after error:', cleanupErr.message);
      }
      throw new Error(
        `User folder created at '${userFolderPath}', but process failed: ${err.message}`,
      );
    }
    throw err;
  }
}

/**
 * Delete user folder using folder_id.
 * @param {string} folderId - The Dropbox user folder ID
 */
async function deleteFolder(folderId) {
  // Input validation
  if (!folderId || typeof folderId !== 'string' || folderId.trim().length === 0) {
    throw new Error('User folder ID is required and must be a non-empty string');
  }

  try {
    // Use folder_id for direct deletion (handles shared folders automatically)
    await dbx.filesDeleteV2({ path: folderId.trim() });

    return {
      success: true,
      method: 'folder_id',
      message: 'User folder deleted successfully',
    };
  } catch (err) {
    // Handle specific error cases
    if (err.status === 409) {
      const errorTag = err.error?.error?.['.tag'];
      if (errorTag === 'path_lookup') {
        throw new Error(`User folder not found`);
      } else if (errorTag === 'path_write') {
        const reason = err.error?.error?.reason?.['.tag'];
        throw new Error(`Cannot delete user folder: ${reason || 'write permission denied'}`);
      }
    }

    if (err.status === 400) {
      const errorSummary = err.error?.error_summary || err.message;
      throw new Error(`Bad request when deleting user folder: ${errorSummary}`);
    }

    if (err.status === 403) {
      throw new Error(`Permission denied: You may not have permission to delete this user folder`);
    }

    if (err.status === 404) {
      throw new Error(`User folder not found`);
    }

    throw new Error(`Failed to delete user folder: ${err.message || 'Unknown error'}`);
  }
}

module.exports = {
  createFolderWithSubfolder,
  createFolderAndInvite,
  deleteFolder,
  getAvailableTeamFolders,
  getTeamFolderPath,
};