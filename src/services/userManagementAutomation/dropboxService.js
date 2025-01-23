const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch');
require('dotenv').config();

// Initialize Dropbox client
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN, fetch: fetch });

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

    return { parentFolderResponse, subfolderResponse };
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

module.exports = {
  createFolderWithSubfolder,
  inviteUserToFolder,
  deleteFolder,
};
