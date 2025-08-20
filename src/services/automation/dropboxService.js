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

// Team folder configuration - easy to extend for future folders
const TEAM_FOLDERS = {
  HGN: '_Highest Good Network Team',
  ADMIN: '_Administration Team',
};

const DEFAULT_TEAM_FOLDER = 'HGN';

/**
 * Get team folder path by key
 */
function getTeamFolderPath(teamFolderKey = DEFAULT_TEAM_FOLDER) {
  const folderName = TEAM_FOLDERS[teamFolderKey];
  if (!folderName) {
    throw new Error(`Invalid team folder key: ${teamFolderKey}`);
  }
  return `/${folderName}`;
}

/**
 * Get available team folders for frontend
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
  let attempts = 0;
  // eslint-disable-next-line no-await-in-loop
  while (attempts < maxAttempts) {
    // eslint-disable-next-line no-await-in-loop
    const status = await dbx.sharingCheckShareJobStatus({ async_job_id: asyncJobId });
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
 * Creates a new project folder under the specified team folder and a 'Week 1' subfolder.
 * Throws if the project folder already exists.
 */
async function createFolderWithSubfolder(projectName, teamFolderKey = DEFAULT_TEAM_FOLDER) {
  const rootPath = getTeamFolderPath(teamFolderKey);
  const projectPath = `${rootPath}/${projectName}`;

  // Ensure root exists
  await ensureFolderExists(rootPath);

  // Check existence
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
async function createFolderAndInvite(email, projectName, teamFolderKey = DEFAULT_TEAM_FOLDER) {
  let folderPath;
  try {
    // 1. Create project folders
    folderPath = await createFolderWithSubfolder(projectName, teamFolderKey);

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

    // Get the folder metadata to retrieve the folder_id
    const folderMetadata = await dbx.filesGetMetadata({ path: folderPath });

    return {
      inviteResponse,
      folderPath,
      sharedFolderId,
      folderId: folderMetadata.result.id,
      folderName: projectName,
    };
  } catch (err) {
    // console.error('Error in createFolderAndInvite:', err);
    if (folderPath) {
      throw new Error(`Folder created at '${folderPath}', but process failed: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Invites a user to an existing shared folder.
 * Assumes the folder is already shared.
 * Throws if the folder doesn't exist or isn't shared.
 */
async function inviteUserToFolder(email, folderPath, teamFolderKey = DEFAULT_TEAM_FOLDER) {
  try {
    // Construct the full path - if it's just a project name, add the team folder prefix
    let normalizedPath;
    if (folderPath.startsWith('/')) {
      normalizedPath = folderPath;
    } else if (Object.values(TEAM_FOLDERS).some((folder) => folderPath.includes(folder))) {
      // Already has a team folder in the path
      normalizedPath = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
    } else {
      // Just the project name, construct full path with specified team folder
      const teamFolderPath = getTeamFolderPath(teamFolderKey);
      normalizedPath = `${teamFolderPath}/${folderPath}`;
    }

    // Get folder metadata to check if it's shared
    const folderMeta = await dbx.filesGetMetadata({ path: normalizedPath });

    if (!folderMeta.result.shared_folder_id) {
      throw new Error(`Folder '${folderPath}' is not shared`);
    }

    // Invite user to the shared folder
    const inviteResponse = await dbx.sharingAddFolderMember({
      shared_folder_id: folderMeta.result.shared_folder_id,
      members: [{ member: { '.tag': 'email', email }, access_level: { '.tag': 'editor' } }],
      quiet: false,
    });

    return {
      inviteResponse,
      sharedFolderId: folderMeta.result.shared_folder_id,
      folderId: folderMeta.result.id,
      folderPath: normalizedPath,
    };
  } catch (err) {
    if (err.status === 409 && err.error?.error?.['.tag'] === 'path_lookup') {
      throw new Error(`Folder '${folderPath}' not found`);
    }
    throw new Error(`Failed to invite user to folder '${folderPath}': ${err.message}`);
  }
}

/**
 * Delete folder using folder_id.
 * @param {string} folderId - The Dropbox folder ID
 */
async function deleteFolder(folderId) {
  try {
    // console.log(`Deleting folder with ID: ${folderId}`);

    if (!folderId) {
      throw new Error('folder_id is required for deletion');
    }

    // Use folder_id for direct deletion (handles shared folders automatically)
    await dbx.filesDeleteV2({ path: folderId });
    // console.log('Folder deleted successfully');

    return {
      success: true,
      method: 'folder_id',
      message: 'Folder deleted successfully',
    };
  } catch (err) {
    // console.error('Error in deleteFolder:', {
    //   message: err.message,
    //   status: err.status,
    //   error: err.error,
    //   folder_id: folderId,
    // });

    // Handle specific error cases
    if (err.status === 409) {
      const errorTag = err.error?.error?.['.tag'];
      if (errorTag === 'path_lookup') {
        throw new Error(`Folder not found`);
      } else if (errorTag === 'path_write') {
        const reason = err.error?.error?.reason?.['.tag'];
        throw new Error(`Cannot delete folder: ${reason || 'write permission denied'}`);
      }
    }

    if (err.status === 400) {
      const errorSummary = err.error?.error_summary || err.message;
      throw new Error(`Bad request when deleting folder: ${errorSummary}`);
    }

    if (err.status === 403) {
      throw new Error(`Permission denied: You may not have permission to delete this folder`);
    }

    if (err.status === 404) {
      throw new Error(`Folder not found`);
    }

    throw new Error(`Failed to delete folder: ${err.message || 'Unknown error'}`);
  }
}

module.exports = {
  createFolderWithSubfolder,
  createFolderAndInvite,
  inviteUserToFolder,
  deleteFolder,
  getAvailableTeamFolders,
  getTeamFolderPath,
};
