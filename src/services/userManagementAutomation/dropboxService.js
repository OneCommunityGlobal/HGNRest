const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch');
const { dropboxConfig } = require('../../constants/automationConstants');

// Initialize Dropbox client with access token
const dbx = new Dropbox({ accessToken: dropboxConfig.accessToken, fetch: fetch });

class DropboxService {
  // Create a new folder in Dropbox
  static async createFolder(folderName) {
    try {
      const response = await dbx.filesCreateFolderV2({ path: `/${folderName}` });
      console.log(`Folder "${folderName}" created successfully!`);
      return response;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  // Create a subfolder inside an existing folder
  static async createSubfolder(parentFolderPath, subfolderName) {
    try {
      const response = await dbx.filesCreateFolderV2({ path: `${parentFolderPath}/${subfolderName}` });
      console.log(`Subfolder "${subfolderName}" created inside "${parentFolderPath}"`);
      return response;
    } catch (error) {
      console.error('Error creating subfolder:', error);
      throw error;
    }
  }

  // Invite a user to a folder with specific permissions
  static async inviteUserToFolder(folderPath, email) {
    try {
      const inviteResponse = await dbx.sharingAddFolderMember({
        shared_folder_id: folderPath,
        members: [
          {
            email: email,
            access_level: 'editor', // Define access level (can be 'viewer' or 'editor')
          },
        ],
        quiet: false,
      });

      console.log(`User ${email} invited as an editor to folder ${folderPath}`);
      return inviteResponse;
    } catch (error) {
      console.error('Error inviting user:', error);
      throw error;
    }
  }

  // Delete a folder from Dropbox
  static async deleteFolder(folderPath) {
    try {
      const response = await dbx.filesDeleteV2({ path: folderPath });
      console.log(`Folder ${folderPath} deleted successfully.`);
      return response;
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  }
}

module.exports = DropboxService;
