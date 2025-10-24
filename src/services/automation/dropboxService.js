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

const HGN_FOLDER = '_Highest Good Network Team';

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
  while (attempts < maxAttempts) {
    const status = await dbx.sharingCheckShareJobStatus({ async_job_id: asyncJobId });
    const tag = status.result['.tag'];
    if (tag === 'complete') {
      return status.result;
    }
    if (tag === 'failed') {
      throw new Error(`Share job failed: ${JSON.stringify(status.result.failed)}`);
    }
    // in_progress
    await new Promise((res) => setTimeout(res, 1000));
    attempts += 1;
  }
  throw new Error('Timeout waiting for share to complete');
}

/**
 * Creates a new project folder under HGN_FOLDER and a 'Week 1' subfolder.
 * Throws if the project folder already exists.
 */
async function createFolderWithSubfolder(projectName) {
  const rootPath = `/${HGN_FOLDER}`;
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
async function createFolderAndInvite(email, projectName) {
  let folderPath;
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
      members: [
        { member: { '.tag': 'email', email }, access_level: { '.tag': 'editor' } },
      ],
      quiet: false,
    });

    return { inviteResponse, folderPath };
  } catch (err) {
    console.error('Error in createFolderAndInvite:', err);
    if (folderPath) {
      throw new Error(`Folder created at '${folderPath}', but process failed: ${err.message}`);
    }
    throw err;
  }
}

module.exports = {
  createFolderWithSubfolder,
  createFolderAndInvite,
};
