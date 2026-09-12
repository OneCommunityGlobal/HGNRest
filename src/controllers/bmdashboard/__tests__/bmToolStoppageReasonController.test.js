// Mock the BuildingProject model - define mock functions BEFORE jest.mock
const mockBuildingProjectExists = jest.fn();

jest.mock('../../../models/bmdashboard/buildingProject', () => ({
  exists: mockBuildingProjectExists,
}));

// Mock Logger
jest.mock('../../../startup/logger', () => ({
  logException: jest.fn(),
  logInfo: jest.fn(),
}));

// Require controller AFTER mocks are set up
const Logger = require('../../../startup/logger');
const toolStoppageReasonController = require('../bmToolStoppageReasonController');
const cacheClosure = require('../../../utilities/nodeCache');

const cache = cacheClosure();
const CACHE_KEY = 'tool-stoppage-reason-projects';

const VALID_PROJECT_ID = '507f1f77bcf86cd799439011';
const ANOTHER_PROJECT_ID = '507f1f77bcf86cd799439012';

// Mock ToolStoppageReason model
const mockToolStoppageReason = {
  aggregate: jest.fn(),
};

describe('Tool Stoppage Reason Controller', () => {
  let controller;
  let req;
  let res;

  beforeEach(() => {
    controller = toolStoppageReasonController(mockToolStoppageReason);

    req = {
      params: {},
      query: {},
      originalUrl: '/api/bm/projects/test/tools-stoppage-reason',
      method: 'GET',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
    mockBuildingProjectExists.mockResolvedValue(true);
    cache.removeCache(CACHE_KEY);
  });

  // ==================== getToolsStoppageReason Tests ====================
  describe('getToolsStoppageReason', () => {
    it('should return 400 for an invalid project ID format', async () => {
      req.params.id = 'not-a-valid-id';

      await controller.getToolsStoppageReason(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid project ID format' });
      expect(mockBuildingProjectExists).not.toHaveBeenCalled();
    });

    it('should return 404 when the project does not exist', async () => {
      req.params.id = VALID_PROJECT_ID;
      mockBuildingProjectExists.mockResolvedValue(false);

      await controller.getToolsStoppageReason(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(body.error).toContain(VALID_PROJECT_ID);
    });

    it('should return 400 for an invalid startDate', async () => {
      req.params.id = VALID_PROJECT_ID;
      req.query.startDate = 'not-a-date';

      await controller.getToolsStoppageReason(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(body.error).toContain('startDate');
    });

    it('should return 400 for an invalid endDate', async () => {
      req.params.id = VALID_PROJECT_ID;
      req.query.startDate = '2024-01-01';
      req.query.endDate = 'not-a-date';

      await controller.getToolsStoppageReason(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(body.error).toContain('endDate');
    });

    it('should return 400 when endDate is before startDate', async () => {
      req.params.id = VALID_PROJECT_ID;
      req.query.startDate = '2024-06-01';
      req.query.endDate = '2024-01-01';

      await controller.getToolsStoppageReason(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(body.error).toContain('date range');
    });

    it('should fetch tool stoppage data successfully with no date filters', async () => {
      req.params.id = VALID_PROJECT_ID;
      const mockResults = [{ toolName: 'Drill', usedForLifetime: 50, damaged: 30, lost: 20 }];
      mockToolStoppageReason.aggregate.mockResolvedValue(mockResults);

      await controller.getToolsStoppageReason(req, res);

      expect(mockToolStoppageReason.aggregate).toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockResults);
      expect(body.count).toBe(1);
      expect(body.message).toBeNull();
    });

    it('should fetch tool stoppage data successfully with valid date range', async () => {
      req.params.id = VALID_PROJECT_ID;
      req.query.startDate = '2024-01-01';
      req.query.endDate = '2024-12-31';
      mockToolStoppageReason.aggregate.mockResolvedValue([]);

      await controller.getToolsStoppageReason(req, res);

      const pipeline = mockToolStoppageReason.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match.date.$gte).toBeInstanceOf(Date);
      expect(pipeline[0].$match.date.$lte).toBeInstanceOf(Date);
    });

    it('should return an informative message when no data is found', async () => {
      req.params.id = VALID_PROJECT_ID;
      mockToolStoppageReason.aggregate.mockResolvedValue([]);

      await controller.getToolsStoppageReason(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.count).toBe(0);
      expect(body.message).toBe('No tool stoppage data found for the specified criteria');
    });

    it('should return 503 when a Mongo connection error occurs', async () => {
      req.params.id = VALID_PROJECT_ID;
      const error = new Error('connection failed');
      error.name = 'MongoNetworkError';
      mockToolStoppageReason.aggregate.mockRejectedValue(error);

      await controller.getToolsStoppageReason(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(body.retry).toBe(true);
    });

    it('should return 500 when a generic database error occurs', async () => {
      req.params.id = VALID_PROJECT_ID;
      mockToolStoppageReason.aggregate.mockRejectedValue(new Error('boom'));

      await controller.getToolsStoppageReason(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(Logger.logException).toHaveBeenCalled();
    });

    it('should log a slow query when execution exceeds threshold', async () => {
      req.params.id = VALID_PROJECT_ID;
      const nowSpy = jest.spyOn(Date, 'now');
      nowSpy.mockReturnValueOnce(0); // startTime
      mockToolStoppageReason.aggregate.mockImplementation(async () => {
        nowSpy.mockReturnValueOnce(1500); // executionTimeMs calculation
        return [];
      });

      await controller.getToolsStoppageReason(req, res);

      expect(Logger.logInfo).toHaveBeenCalled();
      nowSpy.mockRestore();
    });
  });

  // ==================== getUniqueProjectIds Tests ====================
  describe('getUniqueProjectIds', () => {
    it('should fetch unique project IDs with names successfully', async () => {
      const mockAggregateResults = [
        { _id: VALID_PROJECT_ID, projectName: 'Project A' },
        { _id: ANOTHER_PROJECT_ID, projectName: 'Project B' },
      ];
      mockToolStoppageReason.aggregate.mockResolvedValue(mockAggregateResults);

      await controller.getUniqueProjectIds(req, res);

      expect(mockToolStoppageReason.aggregate).toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.data).toEqual([
        { projectId: VALID_PROJECT_ID, projectName: 'Project A' },
        { projectId: ANOTHER_PROJECT_ID, projectName: 'Project B' },
      ]);
      expect(body.cached).toBe(false);
    });

    it('should return an informative message when no projects are found', async () => {
      mockToolStoppageReason.aggregate.mockResolvedValue([]);

      await controller.getUniqueProjectIds(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.count).toBe(0);
      expect(body.message).toBe('No projects with tool stoppage data found');
    });

    it('should return 503 when a Mongo connection error occurs', async () => {
      const error = new Error('timeout');
      error.name = 'MongoTimeoutError';
      mockToolStoppageReason.aggregate.mockRejectedValue(error);

      await controller.getUniqueProjectIds(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      const body = res.json.mock.calls[0][0];
      expect(body.retry).toBe(true);
    });

    it('should return 500 when a generic database error occurs', async () => {
      mockToolStoppageReason.aggregate.mockRejectedValue(new Error('boom'));

      await controller.getUniqueProjectIds(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(false);
    });
  });
});
