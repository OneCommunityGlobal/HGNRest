const dropboxService = require('../../services/userManagementAutomation/dropboxService');

// Create a new folder and a "Week 1" subfolder
async function createFolder(req, res) {
  try {
    const { folderName } = req.body;
    const { parentFolderResponse, subfolderResponse } = await dropboxService.createFolderWithSubfolder(folderName);
    
    res.status(201).json({
      message: 'Folder and subfolder created successfully!',
      parentFolder: parentFolderResponse,
      subfolder: subfolderResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Invite a user to a Dropbox folder
async function inviteUserToFolder(req, res) {
  try {
    const { folderPath, email } = req.body;
    const response = await dropboxService.inviteUserToFolder(folderPath, email);
    res.status(200).json({ message: 'User invited successfully', data: response });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Delete a folder
async function deleteFolder(req, res) {
  try {
    const { folderPath } = req.body;
    const response = await dropboxService.deleteFolder(folderPath);
    res.status(200).json({ message: 'Folder deleted successfully', data: response });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  createFolder,
  inviteUserToFolder,
  deleteFolder,
};
