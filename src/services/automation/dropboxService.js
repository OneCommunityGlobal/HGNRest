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
 * Polls an async share-folder job until complete with exponential backoff.
 * Uses smart polling: starts fast, slows down over time to reduce API calls.
 */
async function waitForShareCompletion(asyncJobId, maxWaitTimeMs = 30000) {
  // Input validation
  if (!asyncJobId || typeof asyncJobId !== 'string' || asyncJobId.trim().length === 0) {
    const validationError = new Error('Async job ID is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  if (maxWaitTimeMs && (typeof maxWaitTimeMs !== 'number' || maxWaitTimeMs <= 0)) {
    const validationError = new Error('Max wait time must be a positive number');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  const startTime = Date.now();
  let attempt = 0;
  let delay = 200; // Start with 200ms
  const maxDelay = 5000; // Cap at 5 seconds

  // Helper function to avoid unsafe references in Promise
  const sleep = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  while (Date.now() - startTime < maxWaitTimeMs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const status = await dbx.sharingCheckShareJobStatus({ async_job_id: asyncJobId.trim() });
      const tag = status.result['.tag'];

      if (tag === 'complete') {
        return status.result;
      }
      if (tag === 'failed') {
        const failedError = new Error(`Share job failed: ${JSON.stringify(status.result.failed)}`);
        failedError.name = 'ProcessError';
        failedError.statusCode = 500;
        throw failedError;
      }

      // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 3200ms, 5000ms (capped)
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay);
      delay = Math.min(delay * 2, maxDelay);
      attempt += 1;
    } catch (error) {
      // If it's our custom error, re-throw it
      if (error.name && error.statusCode) {
        throw error;
      }

      // Handle Dropbox API errors
      if (error.status === 400) {
        const validationError = new Error(`Invalid job ID: ${error.message}`);
        validationError.name = 'ValidationError';
        validationError.statusCode = 400;
        throw validationError;
      }
      if (error.status === 404) {
        const notFoundError = new Error('Share job not found - it may have expired');
        notFoundError.name = 'NotFoundError';
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      // Re-throw other errors
      const apiError = new Error(`Dropbox API error: ${error.message}`);
      apiError.name = 'APIError';
      apiError.statusCode = error.status || 500;
      throw apiError;
    }
  }

  const timeoutError = new Error(
    `Timeout waiting for share to complete after ${maxWaitTimeMs}ms (${attempt} attempts)`,
  );
  timeoutError.name = 'TimeoutError';
  timeoutError.statusCode = 408;
  throw timeoutError;
}

/**
 * Creates a new project folder under HGN_FOLDER and a 'Week 1' subfolder.
 * Throws if the project folder already exists.
 */
async function createFolderWithSubfolder(projectName) {
  // eslint-disable-next-line no-undef
  const rootPath = `/${HGN_FOLDER}`;
  const projectPath = `${rootPath}/${projectName}`;

  // eslint-disable-next-line no-undef
  // Ensure root exists
  await ensureFolderExists(rootPath);

  // eslint-disable-next-line no-undef
  // Validate team folder key
  if (!TEAM_FOLDERS[teamFolderKey]) {
    // eslint-disable-next-line no-undef
    throw new Error(`Invalid team folder key: ${teamFolderKey}`);
  }

  // eslint-disable-next-line no-undef
  // Sanitize user folder name (remove special characters that could cause issues)
  const sanitizedUserFolderName = userFolderName.trim().replace(/[<>:"/\\|?*]/g, '_');
  // eslint-disable-next-line no-undef
  const teamFolderPath = getTeamFolderPath(teamFolderKey);
  const userFolderPath = `${teamFolderPath}/${sanitizedUserFolderName}`;

  // Validate that team folder exists
  await validateFolderExists(teamFolderPath);

  // Check if user folder already exists
  try {
    await dbx.filesGetMetadata({ path: projectPath });
    throw new Error(`Folder '${projectPath}' already exists`);
  } catch (err) {
    if (err.status === 409 && err.error?.error?.['.tag'] === 'path') {
      // Not found, create
      await dbx.filesCreateFolderV2({ path: projectPath });
      await dbx.filesCreateFolderV2({ path: `${projectPath}/Week 1` });
      return projectPath;
    }
    throw err;
  }
}

/**
 * Creates a project folder, shares it, and invites a user.
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
    // 1. Create project folders
    folderPath = await createFolderWithSubfolder(projectName);

    // 2. Initiate share
    const shareResult = await dbx.sharingShareFolder({ path: folderPath });
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
      members: [{ member: { '.tag': 'email', email }, access_level: { '.tag': 'editor' } }],
      quiet: false,
    });

    return { inviteResponse, folderPath };
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

// Get detailed folder information
async function getFolderDetails(folderId) {
  // Input validation
  if (!folderId || typeof folderId !== 'string' || folderId.trim().length === 0) {
    const validationError = new Error('Folder ID is required and must be a non-empty string');
    validationError.name = 'ValidationError';
    validationError.statusCode = 400;
    throw validationError;
  }

  try {
    // Get folder metadata
    const folderMetadata = await dbx.filesGetMetadata({ path: folderId });

    if (folderMetadata.result['.tag'] !== 'folder') {
      const validationError = new Error('Provided ID is not a folder');
      validationError.name = 'ValidationError';
      validationError.statusCode = 400;
      throw validationError;
    }

    // Get folder contents to count files and extract subfolders
    const folderContents = await dbx.filesListFolder({ path: folderId });
    const fileCount = folderContents.result.entries.length;

    // Extract subfolder names (only folders, not files)
    const subfolders = folderContents.result.entries
      .filter((entry) => entry['.tag'] === 'folder')
      .map((folder) => folder.name);

    // Get sharing information and member details
    let sharingInfo = null;
    let sharedMembers = [];

    // Determine sharing info based on folder metadata
    if (folderMetadata.result.sharing_info) {
      // Folder has sharing info, extract details
      sharingInfo = folderMetadata.result.sharing_info;

      if (sharingInfo.shared_folder_id) {
        // Try to get detailed member info using the correct shared_folder_id
        try {
          const membersResponse = await dbx.sharingListFolderMembers({
            shared_folder_id: sharingInfo.shared_folder_id,
          });

          if (membersResponse.result.users) {
            sharedMembers = membersResponse.result.users.map((user) => ({
              email: user.user.email,
              role: user.access_type['.tag'] || 'viewer',
            }));
          }

          if (membersResponse.result.groups) {
            const groupMembers = membersResponse.result.groups.map((group) => ({
              email: `${group.group.group_name} (Group)`,
              role: group.access_type['.tag'] || 'viewer',
            }));
            sharedMembers = [...sharedMembers, ...groupMembers];
          }
        } catch (membersError) {
          // Fallback: Show sharing status based on sharing_info
          const accessLevel = sharingInfo.read_only ? 'viewer' : 'editor';
          sharedMembers = [
            {
              email: 'Team members',
              role: accessLevel,
            },
          ];
        }
      } else {
        // Has sharing info but no shared_folder_id
        const accessLevel = sharingInfo.read_only ? 'viewer' : 'editor';
        sharedMembers = [
          {
            email: 'Team members',
            role: accessLevel,
          },
        ];
      }
    } else {
      // No sharing info in metadata
      sharedMembers = [];
    }

    // Determine team folder
    let teamFolder = 'Unknown';
    const pathParts = folderMetadata.result.path_display.split('/');
    if (pathParts.length > 1) {
      [, teamFolder] = pathParts; // Usually the team folder name
    }

    const folderDetails = {
      folderId,
      folderName: folderMetadata.result.name,
      folderPath: folderMetadata.result.path_display,
      created: folderMetadata.result.server_modified || null,
      size: folderMetadata.result.size || 'Unknown',
      fileCount,
      teamFolder,
      subfolders,
      isShared: sharedMembers.length > 0,
      sharingPermissions: sharingInfo ? sharingInfo.policy : null,
      sharedMembers,
      // Additional info from the response
      sharedFolderId: folderMetadata.result.shared_folder_id,
      parentSharedFolderId: folderMetadata.result.parent_shared_folder_id,
      sharingInfo: folderMetadata.result.sharing_info,
    };

    return folderDetails;
  } catch (error) {
    // If it's already our custom error, re-throw it
    if (error.name && error.statusCode) {
      throw error;
    }

    // Handle network/connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      const networkError = new Error(
        'Unable to connect to Dropbox API - please check your internet connection',
      );
      networkError.name = 'NetworkError';
      networkError.statusCode = 503;
      throw networkError;
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      const timeoutError = new Error('Dropbox API request timed out - please try again');
      timeoutError.name = 'TimeoutError';
      timeoutError.statusCode = 408;
      throw timeoutError;
    }

    // Handle Dropbox API specific errors
    if (error.status === 409) {
      if (error.error?.error?.['.tag'] === 'path') {
        const notFoundError = new Error(
          `Dropbox folder with ID '${folderId}' not found or path is invalid`,
        );
        notFoundError.name = 'NotFoundError';
        notFoundError.statusCode = 404;
        throw notFoundError;
      }
      if (error.error?.error?.['.tag'] === 'shared_folder_no_permission') {
        const permissionError = new Error(
          `Access denied to folder '${folderId}' - you may not have permission to view this shared folder`,
        );
        permissionError.name = 'ForbiddenError';
        permissionError.statusCode = 403;
        throw permissionError;
      }
      // Generic conflict error
      const conflictError = new Error(
        `Dropbox folder operation conflict for '${folderId}' - ${error.error?.error_summary || 'unknown conflict'}`,
      );
      conflictError.name = 'ConflictError';
      conflictError.statusCode = 409;
      throw conflictError;
    }
    if (error.status === 403) {
      const forbiddenError = new Error(
        'Dropbox API access forbidden - your token may lack necessary permissions for folder access',
      );
      forbiddenError.name = 'ForbiddenError';
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }
    if (error.status === 401) {
      const authError = new Error(
        'Dropbox API authentication failed - your token may be invalid or expired. Please re-authenticate.',
      );
      authError.name = 'UnauthorizedError';
      authError.statusCode = 401;
      throw authError;
    }
    if (error.status === 400) {
      const badRequestError = new Error(
        `Invalid folder ID format '${folderId}' - please provide a valid Dropbox folder ID`,
      );
      badRequestError.name = 'ValidationError';
      badRequestError.statusCode = 400;
      throw badRequestError;
    }
    if (error.status === 429) {
      const rateLimitError = new Error(
        'Dropbox API rate limit exceeded - please wait a moment before trying again',
      );
      rateLimitError.name = 'RateLimitError';
      rateLimitError.statusCode = 429;
      throw rateLimitError;
    }
    if (error.status >= 500) {
      const serverError = new Error(
        'Dropbox API is currently experiencing issues - please try again later',
      );
      serverError.name = 'ServerError';
      serverError.statusCode = error.status;
      throw serverError;
    }

    // Generic API error with more context
    const apiError = new Error(
      `Dropbox API error while fetching folder details for '${folderId}': ${error.message || 'Unknown error'}`,
    );
    apiError.name = 'APIError';
    apiError.statusCode = error.status || 500;
    throw apiError;
  }
}

module.exports = {
  createFolderWithSubfolder,
  createFolderAndInvite,
  deleteFolder,
  getAvailableTeamFolders,
  getTeamFolderPath,
  getFolderDetails,
};
