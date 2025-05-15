const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');
require('dotenv').config();

// Initialize Dropbox client
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN, fetch });

// Function to create a folder and a "Week 1" subfolder inside it
async function createFolderWithSubfolder(parentFolderName) {
  try {
    // Create the parent folder
    const parentFolderResponse = await dbx.filesCreateFolderV2({ path: `/${parentFolderName}` });
    console.log(`Parent folder "${parentFolderName}" created successfully!`);

    // Create the "Week 1" subfolder inside the parent folder
    const week1FolderPath = `${parentFolderResponse.result.metadata.path_display}/Week 1`;
    const subfolderResponse = await dbx.filesCreateFolderV2({ path: week1FolderPath });
    console.log(`Subfolder "Week 1" created inside "${parentFolderName}"`);

    return {
      parentFolderResponse: {
        result: {
          id: parentFolderResponse.result.metadata.id,
          path_display: parentFolderResponse.result.metadata.path_display,
        },
      },
      subfolderResponse: {
        result: {
          id: subfolderResponse.result.metadata.id,
          path_display: subfolderResponse.result.metadata.path_display,
        },
      },
    };
  } catch (error) {
    throw new Error(`Error creating folder and subfolder: ${error.message}`);
  }
}

// Function to invite a user to a Dropbox folder
async function inviteUserToFolder(folderPath, email) {
  try {
    const inviteResponse = await dbx.sharingAddFolderMember({
      shared_folder_id: folderPath,
      members: [{ email: email, access_level: 'editor' }],
      quiet: false,
    });
    return inviteResponse;
  } catch (error) {
    throw new Error(`Error inviting user: ${error.message}`);
  }
}

// Function to delete a folder
async function deleteFolder(folderPath) {
  try {
    const response = await dbx.filesDeleteV2({ path: folderPath });
    return response;
  } catch (error) {
    throw new Error(`Error deleting folder: ${error.message}`);
  }
}

// Batch operations
async function batchInviteUsersToFolder(folderPath, users) {
  const results = [];
  for (const user of users) {
    try {
      const result = await inviteUserToFolder(folderPath, user.email, user.accessLevel);
      results.push({ email: user.email, success: true, data: result });
    } catch (error) {
      results.push({ email: user.email, success: false, error: error.message });
    }
    // Add a small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return results;
}

async function batchCreateFolders(folderNames) {
  const results = [];
  for (const folderName of folderNames) {
    try {
      const result = await createFolderWithSubfolder(folderName);
      results.push({ folderName, success: true, data: result });
    } catch (error) {
      results.push({ folderName, success: false, error: error.message });
    }
    // Add a small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return results;
}

async function batchDeleteFolders(folderPaths) {
  const results = [];
  for (const folderPath of folderPaths) {
    try {
      const result = await deleteFolder(folderPath);
      results.push({ folderPath, success: true, data: result });
    } catch (error) {
      results.push({ folderPath, success: false, error: error.message });
    }
    // Add a small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return results;
}

module.exports = {
  createFolderWithSubfolder,
  inviteUserToFolder,
  deleteFolder,
  batchInviteUsersToFolder,
  batchCreateFolders,
  batchDeleteFolders,
};
