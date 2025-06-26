const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch');
require('dotenv').config();

// Initialize Dropbox client
// const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN, fetch });
const dbx = new Dropbox({
  clientId: process.env.DROPBOX_CLIENT_ID,
  clientSecret: process.env.DROPBOX_CLIENT_SECRET,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
  fetch,
});

// Function to create a folder and a "Week 1" subfolder inside it
async function createFolderWithSubfolder(parentFolderName) {
  try {
    const parentFolderResponse = await dbx.filesCreateFolderV2({ path: `/${parentFolderName}` });
    
    // Create the "Week 1" subfolder inside the parent folder
    const week1FolderPath = `${parentFolderResponse.result.metadata.path_display}/Week 1`;
    const subfolderResponse = await dbx.filesCreateFolderV2({ path: week1FolderPath });

    return { parentFolderResponse, subfolderResponse };
  } catch (error) {
    throw new Error('folder creation failed');
  }
}

async function createFolderAndInvite(email, folderName) {
  try {
    const { parentFolderResponse } = await createFolderWithSubfolder(folderName);
    const folderPath = parentFolderResponse.result.metadata.path_display;
    const shareResult = await dbx.sharingShareFolder({
      path: folderPath,
    });
    const sharedFolderId = shareResult.result.shared_folder_id;
    const inviteResponse = await dbx.sharingAddFolderMember({
      shared_folder_id: sharedFolderId,
      members: [{ member: { '.tag': 'email', email }, access_level: { '.tag': 'editor' } }],
      quiet: false,
    });
    return { inviteResponse, folderPath };
  } catch (error) {
    throw new Error(`Dropbox: Error inviting user: ${error.message}`);
  }
}

// Function to invite a user to a Dropbox folder
async function inviteUserToFolder(email, folderPath) {
  try {
    let sharedFolderId;
    try {
      const shareResult = await dbx.sharingShareFolder({ path: folderPath });
      sharedFolderId = shareResult.result.shared_folder_id;
    } catch (shareError) {
      if (shareError.error?.error?.['.tag'] === 'already_shared') {
        sharedFolderId = shareError.error.error.already_shared.shared_folder_id;
      } else {
        throw shareError;
      }
    }
    const inviteResponse = await dbx.sharingAddFolderMember({
      shared_folder_id: sharedFolderId,
      members: [{ member: { '.tag': 'email', email }, access_level: { '.tag': 'editor' } }],
      quiet: false,
    });
    return { inviteResponse, folderPath };
  } catch (error) {
    throw new Error('Dropbox: Error inviting user');
  }
}

// Function to delete a folder
async function deleteFolder(folderPath) {
  try {
    const response = await dbx.filesDeleteV2({ path: `/${folderPath}` });
    return response;
  } catch (error) {
    throw new Error('Dropbox: Error deleting folder');
  }
}

module.exports = {
  createFolderWithSubfolder,
  createFolderAndInvite,
  inviteUserToFolder,
  deleteFolder,
};