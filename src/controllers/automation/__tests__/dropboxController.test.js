jest.mock('../../../services/automation/dropboxService', () => ({
  createFolderAndInvite: jest.fn(),
  deleteFolder: jest.fn(),
  getAvailableTeamFolders: jest.fn(),
  getFolderDetails: jest.fn(),
  DEFAULT_TEAM_FOLDER: 'default-team-folder',
}));

jest.mock('../../../models/userProfile', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../services/automation/appAccessService', () => ({
  getAppAccess: jest.fn(),
  upsertAppAccess: jest.fn(),
  getAppCredentials: jest.fn(),
  revokeAppAccess: jest.fn(),
}));

jest.mock('../utils', () => ({
  checkAppAccess: jest.fn(),
}));

const dropboxService = require('../../../services/automation/dropboxService');
const UserProfile = require('../../../models/userProfile');
const appAccessService = require('../../../services/automation/appAccessService');
const utils = require('../utils');
const {
  createFolder,
  createFolderAndInvite,
  inviteUserToFolder,
  deleteFolder,
  getTeamFolders,
  getFolderDetails,
  checkDropboxAccess,
} = require('../dropboxController');

describe('Dropbox Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    utils.checkAppAccess.mockResolvedValue(true);
  });

  describe('createFolder', () => {
    it('should return 501 because the feature is not implemented', async () => {
      await createFolder(req, res);

      expect(res.status).toHaveBeenCalledWith(501);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not yet implemented',
      });
    });
  });

  describe('inviteUserToFolder', () => {
    it('should return 501 because the feature is not implemented', async () => {
      await inviteUserToFolder(req, res);

      expect(res.status).toHaveBeenCalledWith(501);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Not yet implemented',
      });
    });
  });

  describe('createFolderAndInvite', () => {
    const validBody = {
      requestor: 'admin123',
      folderName: 'John Doe',
      targetUser: {
        targetUserId: 'user123',
        email: 'john@example.com',
      },
    };

    it('should return 403 when requestor is unauthorized', async () => {
      req.body = validBody;
      utils.checkAppAccess.mockResolvedValue(false);

      await createFolderAndInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(UserProfile.findById).not.toHaveBeenCalled();
    });

    it('should return 400 when folder name is missing', async () => {
      req.body = { ...validBody, folderName: '' };

      await createFolderAndInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User folder name and target user information are required',
      });
    });

    it('should return 400 when target user ID is missing', async () => {
      req.body = {
        ...validBody,
        targetUser: { email: 'john@example.com' },
      };

      await createFolderAndInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when email is missing', async () => {
      req.body = {
        ...validBody,
        targetUser: { targetUserId: 'user123' },
      };

      await createFolderAndInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User email is required',
      });
    });

    it('should return 400 when teamFolderKey is invalid', async () => {
      req.body = { ...validBody, teamFolderKey: 'invalid-key' };

      dropboxService.getAvailableTeamFolders.mockReturnValue([{ key: 'valid-key' }]);

      await createFolderAndInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid teamFolderKey provided',
      });
      expect(UserProfile.findById).not.toHaveBeenCalled();
    });

    it('should return 404 when target user does not exist', async () => {
      req.body = validBody;
      UserProfile.findById.mockResolvedValue(null);

      await createFolderAndInvite(req, res);

      expect(UserProfile.findById).toHaveBeenCalledWith('user123');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });

    it('should create folder, invite user and save app access successfully', async () => {
      req.body = validBody;
      UserProfile.findById.mockResolvedValue({ _id: 'user123' });

      dropboxService.createFolderAndInvite.mockResolvedValue({
        folderId: 'folder123',
        folderPath: '/John Doe',
        folderName: 'John Doe',
      });

      appAccessService.upsertAppAccess.mockResolvedValue({});

      await createFolderAndInvite(req, res);

      expect(dropboxService.createFolderAndInvite).toHaveBeenCalledWith(
        'john@example.com',
        'John Doe',
        undefined,
      );

      expect(appAccessService.upsertAppAccess).toHaveBeenCalledWith(
        'user123',
        'dropbox',
        'invited',
        'folder123',
        'default-team-folder',
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User invited successfully to Dropbox folder',
        data: {
          folderPath: '/John Doe',
          folderId: 'folder123',
          folderName: 'John Doe',
          userId: 'user123',
        },
      });
    });

    it('should use the provided teamFolderKey when saving app access', async () => {
      req.body = { ...validBody, teamFolderKey: 'team-key' };

      dropboxService.getAvailableTeamFolders.mockReturnValue([{ key: 'team-key' }]);

      UserProfile.findById.mockResolvedValue({ _id: 'user123' });

      dropboxService.createFolderAndInvite.mockResolvedValue({
        folderId: 'folder123',
        folderPath: '/John Doe',
        folderName: 'John Doe',
      });

      appAccessService.upsertAppAccess.mockResolvedValue({});

      await createFolderAndInvite(req, res);

      expect(appAccessService.upsertAppAccess).toHaveBeenCalledWith(
        'user123',
        'dropbox',
        'invited',
        'folder123',
        'team-key',
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return an error when Dropbox folder creation fails', async () => {
      req.body = validBody;
      UserProfile.findById.mockResolvedValue({ _id: 'user123' });

      dropboxService.createFolderAndInvite.mockRejectedValue(new Error('Dropbox creation failed'));

      await createFolderAndInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Dropbox creation failed',
      });
      expect(appAccessService.upsertAppAccess).not.toHaveBeenCalled();
    });

    it('should use the Dropbox error statusCode when available', async () => {
      req.body = validBody;
      UserProfile.findById.mockResolvedValue({ _id: 'user123' });

      const error = new Error('Dropbox permission denied');
      error.statusCode = 403;

      dropboxService.createFolderAndInvite.mockRejectedValue(error);

      await createFolderAndInvite(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should delete the Dropbox folder when database update fails', async () => {
      req.body = validBody;
      UserProfile.findById.mockResolvedValue({ _id: 'user123' });

      dropboxService.createFolderAndInvite.mockResolvedValue({
        folderId: 'folder123',
        folderPath: '/John Doe',
        folderName: 'John Doe',
      });

      appAccessService.upsertAppAccess.mockRejectedValue(new Error('Database update failed'));

      dropboxService.deleteFolder.mockResolvedValue({});

      await createFolderAndInvite(req, res);

      expect(dropboxService.deleteFolder).toHaveBeenCalledWith('folder123');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message:
          'Database update failed after successful Dropbox folder creation: Database update failed',
      });
    });

    it('should log rollback failure when folder deletion also fails', async () => {
      req.body = validBody;
      UserProfile.findById.mockResolvedValue({ _id: 'user123' });

      dropboxService.createFolderAndInvite.mockResolvedValue({
        folderId: 'folder123',
        folderPath: '/John Doe',
        folderName: 'John Doe',
      });

      appAccessService.upsertAppAccess.mockRejectedValue(new Error('Database failed'));

      dropboxService.deleteFolder.mockRejectedValue(new Error('Rollback failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await createFolderAndInvite(req, res);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to rollback Dropbox folder creation:',
        'Rollback failed',
      );

      expect(res.status).toHaveBeenCalledWith(500);

      consoleSpy.mockRestore();
    });
  });

  describe('deleteFolder', () => {
    const validBody = {
      requestor: 'admin123',
      targetUser: { targetUserId: 'user123' },
    };

    it('should return 400 when target user ID is missing', async () => {
      req.body = {
        requestor: 'admin123',
        targetUser: {},
      };

      await deleteFolder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User ID is required',
      });
    });

    it('should return 400 when requestor is missing', async () => {
      req.body = {
        targetUser: { targetUserId: 'user123' },
      };

      await deleteFolder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Requestor is required',
      });
    });

    it('should return 403 when requestor is unauthorized', async () => {
      req.body = validBody;
      utils.checkAppAccess.mockResolvedValue(false);

      await deleteFolder(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(appAccessService.getAppCredentials).not.toHaveBeenCalled();
    });

    it('should delete Dropbox folder and revoke app access successfully', async () => {
      req.body = validBody;

      appAccessService.getAppCredentials.mockResolvedValue('folder123');
      dropboxService.deleteFolder.mockResolvedValue({
        message: 'Folder deleted',
        method: 'permanent',
      });
      appAccessService.revokeAppAccess.mockResolvedValue({});

      await deleteFolder(req, res);

      expect(appAccessService.getAppCredentials).toHaveBeenCalledWith('user123', 'dropbox');
      expect(dropboxService.deleteFolder).toHaveBeenCalledWith('folder123');
      expect(appAccessService.revokeAppAccess).toHaveBeenCalledWith('user123', 'dropbox');

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Folder deleted',
        data: {
          folderId: 'folder123',
          userId: 'user123',
          method: 'permanent',
        },
      });
    });

    it('should return 500 when Dropbox credentials cannot be found', async () => {
      req.body = validBody;

      appAccessService.getAppCredentials.mockRejectedValue(new Error('Credentials not found'));

      await deleteFolder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Dropbox access not found for this user. They may not have been invited.',
      });
      expect(dropboxService.deleteFolder).not.toHaveBeenCalled();
    });

    it('should return an error when Dropbox folder deletion fails', async () => {
      req.body = validBody;

      appAccessService.getAppCredentials.mockResolvedValue('folder123');
      dropboxService.deleteFolder.mockRejectedValue(new Error('Dropbox deletion failed'));

      await deleteFolder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Dropbox deletion failed',
      });
      expect(appAccessService.revokeAppAccess).not.toHaveBeenCalled();
    });

    it('should return 500 when database access revocation fails', async () => {
      req.body = validBody;

      appAccessService.getAppCredentials.mockResolvedValue('folder123');
      dropboxService.deleteFolder.mockResolvedValue({
        message: 'Folder deleted',
        method: 'permanent',
      });
      appAccessService.revokeAppAccess.mockRejectedValue(new Error('Database failed'));

      await deleteFolder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Database update failed: Database failed',
      });
    });
  });

  describe('getTeamFolders', () => {
    it('should return available Dropbox team folders', async () => {
      const folders = [
        { key: 'team1', name: 'Team One' },
        { key: 'team2', name: 'Team Two' },
      ];

      dropboxService.getAvailableTeamFolders.mockReturnValue(folders);

      await getTeamFolders(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(folders);
    });

    it('should return an error when fetching team folders fails', async () => {
      dropboxService.getAvailableTeamFolders.mockImplementation(() => {
        throw new Error('Unable to fetch team folders');
      });

      await getTeamFolders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Unable to fetch team folders',
      });
    });

    it('should use the error statusCode when fetching team folders fails', async () => {
      const error = new Error('Access denied');
      error.statusCode = 403;

      dropboxService.getAvailableTeamFolders.mockImplementation(() => {
        throw error;
      });

      await getTeamFolders(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getFolderDetails', () => {
    const validBody = {
      requestor: 'admin123',
      targetUser: { targetUserId: 'user123' },
    };

    it('should return 400 when requestor is missing', async () => {
      req.body = {
        targetUser: { targetUserId: 'user123' },
      };

      await getFolderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Requestor is required',
      });
    });

    it('should return 403 when requestor is unauthorized', async () => {
      req.body = validBody;
      utils.checkAppAccess.mockResolvedValue(false);

      await getFolderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(appAccessService.getAppAccess).not.toHaveBeenCalled();
    });

    it('should return 400 when target user ID is missing', async () => {
      req.body = {
        requestor: 'admin123',
        targetUser: {},
      };

      await getFolderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Target user ID is required',
      });
    });

    it('should return 404 when Dropbox access lookup fails', async () => {
      req.body = validBody;

      appAccessService.getAppAccess.mockRejectedValue(new Error('Access not found'));

      await getFolderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No Dropbox access found for this user. They may not have been invited.',
      });
      expect(dropboxService.getFolderDetails).not.toHaveBeenCalled();
    });

    it('should return 403 when Dropbox access status is not invited', async () => {
      req.body = validBody;

      appAccessService.getAppAccess.mockResolvedValue({
        status: 'active',
        credentials: 'folder123',
      });

      await getFolderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message:
          'Cannot view details for active Dropbox access. Only invited access can be viewed.',
      });
      expect(dropboxService.getFolderDetails).not.toHaveBeenCalled();
    });

    it('should return folder details successfully', async () => {
      req.body = validBody;

      appAccessService.getAppAccess.mockResolvedValue({
        status: 'invited',
        credentials: 'folder123',
      });

      dropboxService.getFolderDetails.mockResolvedValue({
        folderName: 'John Doe',
        folderPath: '/John Doe',
        teamFolder: 'Main Team',
        subfolders: ['Week 1', 'Week 2'],
        sharedMembers: [{ email: 'john@example.com', role: 'editor' }],
      });

      await getFolderDetails(req, res);

      expect(dropboxService.getFolderDetails).toHaveBeenCalledWith('folder123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Dropbox folder details retrieved successfully',
        data: {
          'Folder ID': 'folder123',
          'Folder Name': 'John Doe',
          'Folder Path': '/John Doe',
          'Team Folder': 'Main Team',
          Subfolders: 'Week 1, Week 2',
          Members: 'john@example.com (editor)',
        },
      });
    });

    it('should handle empty subfolders and members', async () => {
      req.body = validBody;

      appAccessService.getAppAccess.mockResolvedValue({
        status: 'invited',
        credentials: 'folder123',
      });

      dropboxService.getFolderDetails.mockResolvedValue({
        folderName: 'John Doe',
        folderPath: '/John Doe',
        teamFolder: 'Main Team',
        subfolders: [],
        sharedMembers: [],
      });

      await getFolderDetails(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Dropbox folder details retrieved successfully',
        data: {
          'Folder ID': 'folder123',
          'Folder Name': 'John Doe',
          'Folder Path': '/John Doe',
          'Team Folder': 'Main Team',
          Subfolders: 'No subfolders',
          Members: 'No members found',
        },
      });
    });

    it('should handle missing subfolders and members', async () => {
      req.body = validBody;

      appAccessService.getAppAccess.mockResolvedValue({
        status: 'invited',
        credentials: 'folder123',
      });

      dropboxService.getFolderDetails.mockResolvedValue({
        folderName: 'John Doe',
        folderPath: '/John Doe',
        teamFolder: 'Main Team',
      });

      await getFolderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return an error when Dropbox folder details lookup fails', async () => {
      req.body = validBody;

      appAccessService.getAppAccess.mockResolvedValue({
        status: 'invited',
        credentials: 'folder123',
      });

      dropboxService.getFolderDetails.mockRejectedValue(new Error('Dropbox API failed'));

      await getFolderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Dropbox API failed',
      });
    });

    it('should use the error statusCode when Dropbox folder details lookup fails', async () => {
      req.body = validBody;

      appAccessService.getAppAccess.mockResolvedValue({
        status: 'invited',
        credentials: 'folder123',
      });

      const error = new Error('Dropbox permission denied');
      error.statusCode = 403;

      dropboxService.getFolderDetails.mockRejectedValue(error);

      await getFolderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('checkDropboxAccess', () => {
    it('should return 400 when userId is missing', async () => {
      req.query = {};

      await checkDropboxAccess(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User ID is required',
      });
      expect(appAccessService.getAppAccess).not.toHaveBeenCalled();
    });

    it('should return eligible true when Dropbox status is active', async () => {
      req.query = { userId: 'user123' };

      appAccessService.getAppAccess.mockResolvedValue({
        status: 'active',
      });

      await checkDropboxAccess(req, res);

      expect(appAccessService.getAppAccess).toHaveBeenCalledWith('user123', 'dropbox');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        eligible: true,
        status: 'active',
      });
    });

    it('should return eligible true when Dropbox status is invited', async () => {
      req.query = { userId: 'user123' };

      appAccessService.getAppAccess.mockResolvedValue({
        status: 'invited',
      });

      await checkDropboxAccess(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        eligible: true,
        status: 'invited',
      });
    });

    it('should return eligible false when Dropbox status is inactive', async () => {
      req.query = { userId: 'user123' };

      appAccessService.getAppAccess.mockResolvedValue({
        status: 'inactive',
      });

      await checkDropboxAccess(req, res);

      expect(res.json).toHaveBeenCalledWith({
        eligible: false,
        status: 'inactive',
      });
    });

    it('should return eligible false when no Dropbox access record exists', async () => {
      req.query = { userId: 'user123' };

      appAccessService.getAppAccess.mockResolvedValue(null);

      await checkDropboxAccess(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        eligible: false,
        status: 'none',
      });
    });

    it('should return eligible false when access status is missing', async () => {
      req.query = { userId: 'user123' };

      appAccessService.getAppAccess.mockResolvedValue({});

      await checkDropboxAccess(req, res);

      expect(res.json).toHaveBeenCalledWith({
        eligible: false,
        status: 'none',
      });
    });

    it('should return eligible false and log the error when lookup fails', async () => {
      req.query = { userId: 'user123' };

      const error = new Error('Database connection failed');
      appAccessService.getAppAccess.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await checkDropboxAccess(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to check Dropbox access:', error);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        eligible: false,
        status: 'none',
      });

      consoleSpy.mockRestore();
    });
  });
});
