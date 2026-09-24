// Mock dependencies. These must be declared before requiring titleController:
// titleController captures userProfileController's return value in a
// module-scope closure at require-time, so if the require happens first,
// it silently binds to the real (unmocked) implementation instead.
jest.mock('../models/team');
jest.mock('../models/project');
jest.mock('../utilities/nodeCache');
jest.mock('./userProfileController');
jest.mock('../models/userProfile');

// titleController calls userProfileController(...) once, at module top level,
// and keeps that single return value in a closure for the lifetime of the
// process — it is NOT re-invoked per `titleController(Title)` instance. So the
// mock object it captures must exist (and be wired up) before titleController
// is required, and must stay the same object for the rest of the file; only
// its `getAllTeamCodeHelper` jest.fn() implementation gets reconfigured
// per-test. Recreating this object in `beforeEach` (as if it were per-instance
// state like mockCache) would go unnoticed by titleController's closure.
const userProfileControllerFactory = require('./userProfileController');

const mockUserProfileController = {
  getAllTeamCodeHelper: jest.fn(),
};
userProfileControllerFactory.mockReturnValue(mockUserProfileController);

const titleController = require('./titleController');

// Flushes pending microtasks; needed for code paths that fire off a
// `.then()/.catch()` chain without awaiting or returning it.
const flushPromises = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe('TitleController', () => {
  let mockTitle;
  let mockProject;
  let mockCache;
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
      findOne: jest.fn(),
      exec: jest.fn(),
    };
    // `Project.findOne` below is reassigned onto the real (mocked) `Project`
    // module object, so `mockReturnThis()` would resolve `this` to that
    // object rather than `mockProject`, breaking the `.exec` chain. Return
    // `mockProject` explicitly instead so it works regardless of call-site.
    mockProject.findOne.mockReturnValue(mockProject);

    // Mock cache
    mockCache = {
      getCache: jest.fn(),
      removeCache: jest.fn(),
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
    it('should return all titles sorted by order', async () => {
      const mockTitlesData = [
        { _id: '1', titleName: 'Title 1', order: 1 },
        { _id: '2', titleName: 'Title 2', order: 2 },
      ];
      mockTitle.find().sort().then = jest.fn((onFulfilled) => {
        onFulfilled(mockTitlesData);
        return Promise.resolve();
      });

      await controller.getAllTitles(mockReq, mockRes);

      expect(mockTitle.find).toHaveBeenCalledWith({});
      expect(mockTitle.sort).toHaveBeenCalledWith('order');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockTitlesData);
    });

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

    it('should handle error when fetching title by ID fails', async () => {
      const error = new Error('Not found');
      mockTitle.findById.mockRejectedValue(error);
      mockReq.params.titleId = 'nonexistent';

      await controller.getTitleById(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.send).toHaveBeenCalledWith(error);
    });
  });

  describe('postTitle', () => {
    beforeEach(() => {
      // Mock successful validation
      mockUserProfileController.getAllTeamCodeHelper.mockResolvedValue(['TEAM1', 'TEAM2']);
      mockProject.findOne().exec.mockResolvedValue({ _id: '507f1f77bcf86cd799439011' });
    });

    it('should return error for empty title code', async () => {
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: '',
        teamCode: 'TEAM1',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
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
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
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
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
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
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
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
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
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

    it('should return error for invalid team code', async () => {
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: 'SE',
        teamCode: 'INVALID',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/media/engineer',
        teamAssiged: { _id: 'team123' },
      };

      const MockTitleConstructor = jest.fn(() => ({ save: jest.fn() }));
      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Invalid team code. Please provide a valid team code.',
      });
    });

    it('should use cached team codes instead of refetching when cache is warm', async () => {
      mockCache.getCache.mockReturnValue(JSON.stringify(['TEAM1', 'TEAM2']));
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: 'SE',
        teamCode: 'TEAM1',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/media/engineer',
        teamAssiged: { _id: 'N/A' },
      };

      const MockTitleConstructor = jest.fn(() => ({ save: jest.fn() }));
      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);

      expect(mockUserProfileController.getAllTeamCodeHelper).not.toHaveBeenCalled();
      // Team code passed cache validation, so it proceeds to the next check.
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'Team not exists.' });
    });

    it('should return error when project does not exist', async () => {
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: 'SE',
        teamCode: 'TEAM1',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/media/engineer',
        teamAssiged: { _id: 'team123' },
      };
      mockProject.findOne().exec.mockResolvedValue(null);

      const MockTitleConstructor = jest.fn(() => ({ save: jest.fn() }));
      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Project is empty or not exist.',
      });
    });

    it('should return error when assigned team does not exist', async () => {
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: 'SE',
        teamCode: 'TEAM1',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/media/engineer',
        teamAssiged: { _id: 'N/A' },
      };

      const MockTitleConstructor = jest.fn(() => ({ save: jest.fn() }));
      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'Team not exists.' });
    });

    it('should create title successfully with valid data', async () => {
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: 'SE',
        teamCode: 'TEAM1',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/media/engineer',
        teamAssiged: { _id: 'team123' },
      };

      const savedTitle = { _id: 'newTitle1', ...mockReq.body, shortName: 'S' };
      const mockSave = jest.fn().mockResolvedValue(savedTitle);
      const MockTitleConstructor = jest.fn(() => ({ save: mockSave }));

      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);
      await flushPromises();

      expect(mockSave).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(savedTitle);
    });

    it('should return 404 when saving the new title fails', async () => {
      mockReq.body = {
        titleName: 'Software Engineer',
        titleCode: 'SE',
        teamCode: 'TEAM1',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/media/engineer',
        teamAssiged: { _id: 'team123' },
      };

      const saveError = new Error('Save failed');
      const MockTitleConstructor = jest.fn(() => ({
        save: jest.fn().mockRejectedValue(saveError),
      }));

      const testController = titleController(MockTitleConstructor);

      await testController.postTitle(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(saveError);
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

    it('should handle error when refetching sorted titles fails after a successful update', async () => {
      const error = new Error('Sort fetch failed');
      mockReq.body = { orderData: [{ id: 'title1', order: 1 }] };

      mockTitle.findByIdAndUpdate.mockResolvedValue({ _id: 'title1', order: 1 });
      mockTitle.sort.mockRejectedValueOnce(error);

      await controller.updateTitlesOrder(mockReq, mockRes);

      expect(mockTitle.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Failed to update titles order',
        error,
      });
    });

    it('should handle an empty orderData array without updating anything', async () => {
      mockReq.body = { orderData: [] };
      mockTitle.find().sort.mockResolvedValue([]);

      await controller.updateTitlesOrder(mockReq, mockRes);

      expect(mockTitle.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('updateTitle', () => {
    beforeEach(() => {
      // Mock successful validation
      mockUserProfileController.getAllTeamCodeHelper.mockResolvedValue(['TEAM1', 'TEAM2']);
      mockProject.findOne().exec.mockResolvedValue({ _id: '507f1f77bcf86cd799439011' });
    });

    it('should return error for empty title name during update', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: '',
        titleCode: 'NT',
        teamCode: 'TEAM1',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
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
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
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
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
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
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
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
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/new/media',
        teamAssiged: { _id: 'team123' },
      };

      await controller.updateTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Please provide a team code.',
      });
    });

    it('should return error for invalid team code during update', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: 'New Title',
        titleCode: 'NT',
        teamCode: 'INVALID',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/new/media',
        teamAssiged: { _id: 'team123' },
      };

      await controller.updateTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Invalid team code. Please provide a valid team code.',
      });
    });

    it('should return error when project does not exist during update', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: 'New Title',
        titleCode: 'NT',
        teamCode: 'TEAM1',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/new/media',
        teamAssiged: { _id: 'team123' },
      };
      mockProject.findOne().exec.mockResolvedValue(null);

      await controller.updateTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Project is empty or not exist.',
      });
    });

    it('should return error when assigned team does not exist during update', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: 'New Title',
        titleCode: 'NT',
        teamCode: 'TEAM1',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/new/media',
        teamAssiged: { _id: 'N/A' },
      };

      await controller.updateTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'Team not exists.' });
    });

    it('should update title successfully with valid data', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: 'New Title',
        titleCode: 'NT',
        teamCode: 'TEAM2',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/new/media',
        teamAssiged: { _id: 'team123' },
      };

      const mockResultDoc = {
        teamCode: 'TEAM1',
        save: jest.fn().mockResolvedValue(true),
      };
      mockTitle.findById.mockResolvedValue(mockResultDoc);
      mockUserProfile.updateMany.mockResolvedValue({});

      await controller.updateTitle(mockReq, mockRes);

      expect(mockTitle.findById).toHaveBeenCalledWith('title123');
      expect(mockResultDoc.titleName).toBe('New Title');
      expect(mockResultDoc.teamCode).toBe('TEAM2');
      expect(mockResultDoc.save).toHaveBeenCalled();
      expect(mockUserProfile.updateMany).toHaveBeenCalledWith(
        { teamCode: 'TEAM1' },
        { $set: { teamCode: 'TEAM2' } },
      );
      expect(mockCache.removeCache).toHaveBeenCalledWith('teamCodes');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Update successful',
        updatedTitle: mockResultDoc,
      });
    });

    it('should handle error during update', async () => {
      mockReq.body = {
        id: 'title123',
        titleName: 'New Title',
        titleCode: 'NT',
        teamCode: 'TEAM1',
        projectAssigned: { _id: '507f1f77bcf86cd799439011' },
        mediaFolder: '/new/media',
        teamAssiged: { _id: 'team123' },
      };
      const error = new Error('Update failed');
      mockTitle.findById.mockRejectedValue(error);

      await controller.updateTitle(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'An error occurred',
        error: error.message,
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

    it('should handle error when deleting title fails', async () => {
      const error = new Error('Delete failed');
      mockTitle.deleteOne.mockRejectedValue(error);
      mockReq.params.titleId = 'title123';

      await controller.deleteTitleById(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.send).toHaveBeenCalledWith(error);
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

    it('should handle error when deleting all titles fails', async () => {
      const error = new Error('Delete all failed');
      mockTitle.deleteMany.mockRejectedValue(error);

      await controller.deleteAllTitles(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(error);
    });
  });
});
