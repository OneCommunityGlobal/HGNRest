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
    const validationError = new Error('Team folder key is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  const folderName = TEAM_FOLDERS[teamFolderKey];
  if (!folderName) {
    const notFoundError = new Error(`Invalid Dropbox team folder key: ${teamFolderKey}`);
    notFoundError.name = 'NotFoundError';
    notFoundError.statusCode = 404;
    throw notFoundError;
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
 * Validate that a folder exists at the given path. Throws error if missing.
 * Admin must pre-create team folders - this function only validates they exist.
 */
async function validateFolderExists(path) {
  // Input validation
  if (!path || typeof path !== 'string' || path.trim().length === 0) {
    const validationError = new Error('Path is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  // Validate path format (must start with /)
  if (!path.startsWith('/')) {
    const validationError = new Error('Path must start with /');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  try {
    const metadata = await dbx.filesGetMetadata({ path });

    // Verify it's actually a folder, not a file
    if (metadata.result['.tag'] !== 'folder') {
      const validationError = new Error(`Path '${path}' exists but is not a folder`);
      validationError.name = 'ValidationError';
      validationError.statusCode = 400;
      throw validationError;
    }

    return metadata.result;
  } catch (err) {
    if (err.status === 409 && err.error?.error?.['.tag'] === 'path') {
      // Folder doesn't exist - this is now an error, not auto-creation
      const notFoundError = new Error(
        `Team folder '${path}' does not exist. Please contact an administrator to create the required team folder structure.`,
      );
      notFoundError.name = 'NotFoundError';
      notFoundError.statusCode = 404;
      throw notFoundError;
    } else if (err.status === 403) {
      const forbiddenError = new Error('Dropbox API access forbidden - check token permissions');
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    } else if (err.status === 401) {
      const authError = new Error('Dropbox API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    } else {
      const apiError = new Error(`Dropbox API error: ${err.message}`);
      apiError.name = 'APIError';
      apiError.statusCode = err.status || 500;
      throw apiError;
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

  // Validate that team folder exists
  await validateFolderExists(teamFolderPath);

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
    const validationError = new Error('Email is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    const validationError = new Error('Invalid email format');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  if (!userFolderName || typeof userFolderName !== 'string' || userFolderName.trim().length === 0) {
    const validationError = new Error(
      'User folder name is required and must be a non-empty string',
    );
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  if (!teamFolderKey || typeof teamFolderKey !== 'string' || teamFolderKey.trim().length === 0) {
    const validationError = new Error('Team folder key is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  // Validate team folder key
  if (!TEAM_FOLDERS[teamFolderKey]) {
    const notFoundError = new Error(`Invalid team folder key: ${teamFolderKey}`);
    notFoundError.name = 'NotFoundError';
    notFoundError.statusCode = 404;
    throw notFoundError;
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
    // If it's already our custom error with proper properties, re-throw it
    if (err.name && err.statusCode) {
      throw err;
    }

    if (userFolderPath) {
      // Try to clean up the created user folder
      try {
        await dbx.filesDeleteV2({ path: userFolderPath });
      } catch (cleanupErr) {
        // Log cleanup error but don't throw it
        console.error('Failed to cleanup user folder after error:', cleanupErr.message);
      }

      const processError = new Error(
        `User folder created at '${userFolderPath}', but process failed: ${err.message}`,
      );
      processError.name = 'ProcessError';
      processError.statusCode = 500;
      throw processError;
    }

    // Handle Dropbox API specific errors
    if (err.status === 400) {
      const validationError = new Error(`Dropbox API validation error: ${err.message}`);
      validationError.name = 'ValidationError';
      validationError.statusCode = 400;
      throw validationError;
    }
    if (err.status === 401) {
      const authError = new Error('Dropbox API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }
    if (err.status === 403) {
      const forbiddenError = new Error('Dropbox API access forbidden - check token permissions');
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (err.status === 409) {
      const conflictError = new Error(`Dropbox conflict error: ${err.message}`);
      conflictError.name = 'ConflictError';
      conflictError.statusCode = 409;
      throw conflictError;
    }

    const apiError = new Error(`Dropbox API error: ${err.message}`);
    apiError.name = 'APIError';
    apiError.statusCode = err.status || 500;
    throw apiError;
  }
}

/**
 * Delete user folder using folder_id.
 * @param {string} folderId - The Dropbox user folder ID
 */
async function deleteFolder(folderId) {
  // Input validation
  if (!folderId || typeof folderId !== 'string' || folderId.trim().length === 0) {
    const validationError = new Error('User folder ID is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
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
        const notFoundError = new Error('User folder not found');
        notFoundError.name = 'NotFoundError';
        notFoundError.statusCode = 404;
        throw notFoundError;
      } else if (errorTag === 'path_write') {
        const reason = err.error?.error?.reason?.['.tag'];
        const conflictError = new Error(
          `Cannot delete user folder: ${reason || 'write permission denied'}`,
        );
        conflictError.name = 'ConflictError';
        conflictError.statusCode = 409;
        throw conflictError;
      }
    }

    if (err.status === 400) {
      const errorSummary = err.error?.error_summary || err.message;
      const validationError = new Error(`Bad request when deleting user folder: ${errorSummary}`);
      validationError.name = 'ValidationError';
      validationError.statusCode = 400;
      throw validationError;
    }

    if (err.status === 403) {
      const forbiddenError = new Error(
        'Permission denied: You may not have permission to delete this user folder',
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }

    if (err.status === 404) {
      const notFoundError = new Error('User folder not found');
      notFoundError.name = 'NotFoundError';
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    if (err.status === 401) {
      const authError = new Error('Dropbox API authentication failed - check token validity');
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }

    const apiError = new Error(`Failed to delete user folder: ${err.message || 'Unknown error'}`);
    apiError.name = 'APIError';
    apiError.statusCode = err.status || 500;
    throw apiError;
  }
}

module.exports = {
  createFolderWithSubfolder,
  createFolderAndInvite,
  deleteFolder,
  getAvailableTeamFolders,
  getTeamFolderPath,
};
