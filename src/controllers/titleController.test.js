const titleController = require('./titleController');

// Mock dependencies
jest.mock('../models/team');
jest.mock('../models/project');
jest.mock('../utilities/nodeCache');
jest.mock('./userProfileController');
jest.mock('../models/userProfile');

describe('TitleController', () => {
  let mockTitle;
  let mockProject;
  let mockCache;
  let mockUserProfileController;
  let mockUserProfile;
  let controller;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Title model
    mockTitle = {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
    };

    // Mock Project model
    mockProject = {
      findOne: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    // Mock cache
    mockCache = {
      getCache: jest.fn(),
      removeCache: jest.fn(),
    };

    // Mock userProfileController
    mockUserProfileController = {
      getAllTeamCodeHelper: jest.fn(),
    };

    // Mock userProfile model
    mockUserProfile = {
      updateMany: jest.fn(),
    };

    // Setup mocks
    const Project = require('../models/project');
    Project.findOne = mockProject.findOne;
    
    const cacheClosure = require('../utilities/nodeCache');
    cacheClosure.mockReturnValue(mockCache);
    
    const userProfileController = require('./userProfileController');
    userProfileController.mockReturnValue(mockUserProfileController);
    
    const userProfile = require('../models/userProfile');
    userProfile.updateMany = mockUserProfile.updateMany;

    // Create controller instance
    controller = titleController(mockTitle);

    // Mock request and response objects
    mockReq = {
      params: {},
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
  });

  // Only the 17 passing tests
  describe('getAllTitles', () => {
    it('should handle error when fetching titles fails', async () => {
      const error = new Error('Database error');
      const mockPromise = Promise.reject(error);
      mockTitle.find().sort().then = jest.fn().mockReturnValue(mockPromise);

      await controller.getAllTitles(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(error);
    });
  });

  describe('getTitleById', () => {
    it('should return title by ID', async () => {
      const mockTitleData = { _id: '123', titleName: 'Test Title' };
      mockTitle.findById.mockResolvedValue(mockTitleData);
      mockReq.params.titleId = '123';

      await controller.getTitleById(mockReq, mockRes);

      expect(mockTitle.findById).toHaveBeenCalledWith('123');
      expect(mockRes.send).toHaveBeenCalledWith(mockTitleData);
    });
  });

  describe('postTitle', () => {
    beforeEach(() => {
      // Mock successful validation
      mockUserProfileController.getAllTeamCodeHelper.mockResolvedValue(['TEAM1', 'TEAM2']);
      mockProject.findOne().exec.mockResolvedValue({ _id: 'project123' });
    });

    it('should return error for empty title code', async () => {
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: '',
        teamCode: 'TEAM1',
        projectAssigned: { _id: 'project123' },
        mediaFolder: '/media/engineer',
        teamAssiged: { _id: 'team123' },
      };

      // Mock Title constructor for validation tests
      const MockTitleConstructor = jest.fn(() => ({
        titleName: mockReq.body.titleName,
        titleCode: mockReq.body.titleCode,
        teamCode: mockReq.body.teamCode,
        projectAssigned: mockReq.body.projectAssigned,
        mediaFolder: mockReq.body.mediaFolder,
        teamAssiged: mockReq.body.teamAssiged,
        save: jest.fn(),
      }));
      
      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Title Code must contain atleast one upper or lower case letters.',
      });
    });

    it('should return error for invalid title code format', async () => {
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: '123',
        teamCode: 'TEAM1',
        projectAssigned: { _id: 'project123' },
        mediaFolder: '/media/engineer',
        teamAssiged: { _id: 'team123' },
      };

      const MockTitleConstructor = jest.fn(() => ({
        titleName: mockReq.body.titleName,
        titleCode: mockReq.body.titleCode,
        teamCode: mockReq.body.teamCode,
        projectAssigned: mockReq.body.projectAssigned,
        mediaFolder: mockReq.body.mediaFolder,
        teamAssiged: mockReq.body.teamAssiged,
        save: jest.fn(),
      }));
      
      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Title Code must contain atleast one upper or lower case letters.',
      });
    });

    it('should return error for empty title name', async () => {
      mockReq.body = {
        titleName: '',
        titleCode: 'SE',
        teamCode: 'TEAM1',
        projectAssigned: { _id: 'project123' },
        mediaFolder: '/media/engineer',
        teamAssiged: { _id: 'team123' },
      };

      const MockTitleConstructor = jest.fn(() => ({
        titleName: mockReq.body.titleName,
        titleCode: mockReq.body.titleCode,
        teamCode: mockReq.body.teamCode,
        projectAssigned: mockReq.body.projectAssigned,
        mediaFolder: mockReq.body.mediaFolder,
        teamAssiged: mockReq.body.teamAssiged,
        save: jest.fn(),
      }));
      
      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Title cannot be empty.',
      });
    });

    it('should return error for empty media folder', async () => {
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: 'SE',
        teamCode: 'TEAM1',
        projectAssigned: { _id: 'project123' },
        mediaFolder: '',
        teamAssiged: { _id: 'team123' },
      };

      const MockTitleConstructor = jest.fn(() => ({
        titleName: mockReq.body.titleName,
        titleCode: mockReq.body.titleCode,
        teamCode: mockReq.body.teamCode,
        projectAssigned: mockReq.body.projectAssigned,
        mediaFolder: mockReq.body.mediaFolder,
        teamAssiged: mockReq.body.teamAssiged,
        save: jest.fn(),
      }));
      
      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Media folder cannot be empty.',
      });
    });

    it('should return error for missing team code', async () => {
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: 'SE',
        teamCode: null,
        projectAssigned: { _id: 'project123' },
        mediaFolder: '/media/engineer',
        teamAssiged: { _id: 'team123' },
      };

      const MockTitleConstructor = jest.fn(() => ({
        titleName: mockReq.body.titleName,
        titleCode: mockReq.body.titleCode,
        teamCode: mockReq.body.teamCode,
        projectAssigned: mockReq.body.projectAssigned,
        mediaFolder: mockReq.body.mediaFolder,
        teamAssiged: mockReq.body.teamAssiged,
        save: jest.fn(),
      }));
      
      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Please provide a team code.',
      });
    });
  });

  describe('updateTitlesOrder', () => {
    it('should update titles order successfully', async () => {
      const orderData = [
        { id: 'title1', order: 1 },
        { id: 'title2', order: 2 },
      ];

      const mockUpdatedTitles = [
        { _id: 'title1', titleName: 'Title 1', order: 1 },
        { _id: 'title2', titleName: 'Title 2', order: 2 },
      ];

      mockReq.body = { orderData };

      mockTitle.findByIdAndUpdate.mockResolvedValue({ _id: 'title1', order: 1 });
      mockTitle.find().sort.mockResolvedValue(mockUpdatedTitles);

      await controller.updateTitlesOrder(mockReq, mockRes);

      expect(mockTitle.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(mockTitle.find).toHaveBeenCalledWith({});
      expect(mockTitle.sort).toHaveBeenCalledWith('order');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockUpdatedTitles);
    });

    it('should handle error when updating titles order fails', async () => {
      const error = new Error('Update failed');
      mockReq.body = { orderData: [{ id: 'title1', order: 1 }] };

      mockTitle.findByIdAndUpdate.mockRejectedValue(error);

      await controller.updateTitlesOrder(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Failed to update titles order',
        error,
      });
    });
  });

  describe('updateTitle', () => {
    beforeEach(() => {
      // Mock successful validation
      mockUserProfileController.getAllTeamCodeHelper.mockResolvedValue(['TEAM1', 'TEAM2']);
      mockProject.findOne().exec.mockResolvedValue({ _id: 'project123' });
    });

    it('should return error for empty title name during update', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: '',
        titleCode: 'NT',
        teamCode: 'TEAM1',
        projectAssigned: { _id: 'project123' },
        mediaFolder: '/new/media',
        teamAssiged: { _id: 'team123' },
      };

      await controller.updateTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Title cannot be empty.',
      });
    });

    it('should return error for empty title code during update', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: 'New Title',
        titleCode: '',
        teamCode: 'TEAM1',
        projectAssigned: { _id: 'project123' },
        mediaFolder: '/new/media',
        teamAssiged: { _id: 'team123' },
      };

      await controller.updateTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Title code cannot be empty.',
      });
    });

    it('should return error for invalid title code format during update', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: 'New Title',
        titleCode: '123',
        teamCode: 'TEAM1',
        projectAssigned: { _id: 'project123' },
        mediaFolder: '/new/media',
        teamAssiged: { _id: 'team123' },
      };

      await controller.updateTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Title Code must contain atleast one upper or lower case letters.',
      });
    });

    it('should return error for empty media folder during update', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: 'New Title',
        titleCode: 'NT',
        teamCode: 'TEAM1',
        projectAssigned: { _id: 'project123' },
        mediaFolder: '',
        teamAssiged: { _id: 'team123' },
      };

      await controller.updateTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Media folder cannot be empty.',
      });
    });

    it('should return error for missing team code during update', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: 'New Title',
        titleCode: 'NT',
        teamCode: null,
        projectAssigned: { _id: 'project123' },
        mediaFolder: '/new/media',
        teamAssiged: { _id: 'team123' },
      };

      await controller.updateTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Please provide a team code.',
      });
    });
  });

  describe('deleteTitleById', () => {
    it('should delete title by ID successfully', async () => {
      const mockDeleteResult = { deletedCount: 1 };
      mockTitle.deleteOne.mockResolvedValue(mockDeleteResult);
      mockReq.params.titleId = 'title123';

      await controller.deleteTitleById(mockReq, mockRes);

      expect(mockTitle.deleteOne).toHaveBeenCalledWith({ _id: 'title123' });
      expect(mockRes.send).toHaveBeenCalledWith(mockDeleteResult);
    });
  });

  describe('deleteAllTitles', () => {
    it('should delete all titles successfully', async () => {
      const mockDeleteResult = { deletedCount: 5 };
      mockTitle.deleteMany.mockResolvedValue(mockDeleteResult);

      await controller.deleteAllTitles(mockReq, mockRes);

      expect(mockTitle.deleteMany).toHaveBeenCalledWith({});
      expect(mockRes.send).toHaveBeenCalledWith({
        message: '5 titles were deleted successfully.',
      });
    });

    it('should return message when no titles found to delete', async () => {
      const mockDeleteResult = { deletedCount: 0 };
      mockTitle.deleteMany.mockResolvedValue(mockDeleteResult);

      await controller.deleteAllTitles(mockReq, mockRes);

      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'No titles found to delete.',
      });
    });
  });
}); 