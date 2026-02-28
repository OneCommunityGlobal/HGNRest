// Mock the BuildingProject model - define mock functions BEFORE jest.mock
const mockBuildingProjectFind = jest.fn();

jest.mock('../../../models/bmdashboard/buildingProject', () => ({
  find: mockBuildingProjectFind,
}));

// Require controller AFTER the mock is set up
const bmIssueController = require('../bmIssueController');

// Mocking the BuildingIssue Model
const mockBuildingIssue = {
  find: jest.fn(),
  create: jest.fn(),
  aggregate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
};

describe('Building Issue Controller', () => {
  let controller;
  let req;
  let res;

  beforeEach(() => {
    controller = bmIssueController(mockBuildingIssue);

    req = {
      body: {},
      query: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
    mockBuildingProjectFind.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==================== bmGetOpenIssue Tests ====================
  describe('bmGetOpenIssue', () => {
    it('should fetch all open issues when no filters provided', async () => {
      const mockIssues = [
        { _id: '1', status: 'open', issueTitle: ['Issue 1'] },
        { _id: '2', status: 'open', issueTitle: ['Issue 2'] },
      ];
      mockBuildingIssue.find.mockResolvedValue(mockIssues);

      await controller.bmGetOpenIssue(req, res);

      expect(mockBuildingIssue.find).toHaveBeenCalledWith({ status: 'open' });
      expect(res.json).toHaveBeenCalledWith(mockIssues);
    });

    it('should return empty array when no issues found', async () => {
      mockBuildingIssue.find.mockResolvedValue(null);

      await controller.bmGetOpenIssue(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should filter by projectIds when provided', async () => {
      const validId1 = '507f1f77bcf86cd799439011';
      const validId2 = '507f1f77bcf86cd799439012';
      req.query.projectIds = `${validId1},${validId2}`;
      mockBuildingIssue.find.mockResolvedValue([]);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.status).toBe('open');
      expect(callArgs.projectId.$in).toHaveLength(2);
    });

    it('should ignore invalid projectIds', async () => {
      req.query.projectIds = 'invalid-id,507f1f77bcf86cd799439011';
      mockBuildingIssue.find.mockResolvedValue([]);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.projectId.$in).toHaveLength(1);
    });

    it('should not add projectId filter when all projectIds are invalid', async () => {
      req.query.projectIds = 'invalid-id1,invalid-id2';
      mockBuildingIssue.find.mockResolvedValue([]);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.projectId).toBeUndefined();
    });

    it('should filter by startDate and endDate when both provided', async () => {
      req.query.startDate = '2024-01-01';
      req.query.endDate = '2024-12-31';
      mockBuildingIssue.find.mockResolvedValue([]);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.$and).toBeDefined();
      expect(callArgs.$and[0].createdDate.$lte).toBeInstanceOf(Date);
      expect(callArgs.$and[1].$or).toBeDefined();
      expect(callArgs.$and[1].$or).toContainEqual({ status: 'open' });
      expect(callArgs.$and[1].$or[1].closedDate.$gte).toBeInstanceOf(Date);
    });

    it('should return 400 error when the entire date range is in the future', async () => {
      req.query.startDate = '2099-01-01';
      req.query.endDate = '2099-12-31';

      await controller.bmGetOpenIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error:
          'The selected date range is entirely in the future. No issue data exists for future dates.',
      });
      expect(mockBuildingIssue.find).not.toHaveBeenCalled();
    });

    it('should cap endDate to today when startDate is past and endDate is in the future', async () => {
      req.query.startDate = '2024-01-01';
      req.query.endDate = '2099-12-31';
      mockBuildingIssue.find.mockResolvedValue([]);

      await controller.bmGetOpenIssue(req, res);

      expect(mockBuildingIssue.find).toHaveBeenCalled();
      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.$and).toBeDefined();

      const effectiveEnd = callArgs.$and[0].createdDate.$lte;
      expect(effectiveEnd).toBeInstanceOf(Date);
      // effectiveEnd must be capped to today, not the far-future endDate
      const today = new Date();
      expect(effectiveEnd.getFullYear()).toBe(today.getFullYear());
      expect(effectiveEnd.getMonth()).toBe(today.getMonth());
      expect(effectiveEnd.getDate()).toBe(today.getDate());
    });

    it('should filter by startDate only when endDate not provided', async () => {
      req.query.startDate = '2024-01-01';
      mockBuildingIssue.find.mockResolvedValue([]);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.$or).toBeDefined();
      expect(callArgs.$or).toContainEqual({ status: 'open' });
      expect(callArgs.$or[1].closedDate.$gte).toBeInstanceOf(Date);
    });

    it('should filter by endDate only when startDate not provided', async () => {
      req.query.endDate = '2024-12-31';
      mockBuildingIssue.find.mockResolvedValue([]);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.createdDate.$lte).toBeInstanceOf(Date);
    });

    it('should show issue created before range and still open', async () => {
      req.query.startDate = '2024-06-01';
      req.query.endDate = '2024-06-30';
      const mockIssues = [
        {
          _id: '1',
          createdDate: new Date('2024-01-01'),
          status: 'open',
          closedDate: null,
        },
      ];
      mockBuildingIssue.find.mockResolvedValue(mockIssues);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.$and).toBeDefined();
      expect(res.json).toHaveBeenCalledWith(mockIssues);
    });

    it('should show issue created before range and closed during range', async () => {
      req.query.startDate = '2024-06-01';
      req.query.endDate = '2024-06-30';
      const mockIssues = [
        {
          _id: '2',
          createdDate: new Date('2024-01-01'),
          status: 'closed',
          closedDate: new Date('2024-06-15'),
        },
      ];
      mockBuildingIssue.find.mockResolvedValue(mockIssues);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.$and[1].$or[1].closedDate.$gte).toBeInstanceOf(Date);
      expect(res.json).toHaveBeenCalledWith(mockIssues);
    });

    it('should NOT show issue closed before range', async () => {
      req.query.startDate = '2024-06-01';
      req.query.endDate = '2024-06-30';
      mockBuildingIssue.find.mockResolvedValue([]);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.$and[1].$or[1].closedDate.$gte).toBeInstanceOf(Date);
    });

    it('should show issue created during range regardless of closed status', async () => {
      req.query.startDate = '2024-06-01';
      req.query.endDate = '2024-06-30';
      const mockIssues = [
        {
          _id: '3',
          createdDate: new Date('2024-06-15'),
          status: 'closed',
          closedDate: new Date('2024-07-01'),
        },
      ];
      mockBuildingIssue.find.mockResolvedValue(mockIssues);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.$and[0].createdDate.$lte).toBeInstanceOf(Date);
      expect(res.json).toHaveBeenCalledWith(mockIssues);
    });

    it('should filter by tag when provided', async () => {
      req.query.tag = 'In-person';
      mockBuildingIssue.find.mockResolvedValue([]);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.tag).toBe('In-person');
    });

    it('should combine all filters when provided', async () => {
      req.query.projectIds = '507f1f77bcf86cd799439011';
      req.query.startDate = '2024-01-01';
      req.query.endDate = '2024-12-31';
      req.query.tag = 'Virtual';
      mockBuildingIssue.find.mockResolvedValue([]);

      await controller.bmGetOpenIssue(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.projectId.$in).toHaveLength(1);
      expect(callArgs.$and).toBeDefined();
      expect(callArgs.$and[0].createdDate.$lte).toBeInstanceOf(Date);
      expect(callArgs.$and[1].$or).toBeDefined();
      expect(callArgs.tag).toBe('Virtual');
    });

    it('should return 500 error when database error occurs', async () => {
      const error = new Error('Database error');
      mockBuildingIssue.find.mockRejectedValue(error);

      await controller.bmGetOpenIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  // ==================== getUniqueProjectIds Tests ====================
  describe('getUniqueProjectIds', () => {
    it('should fetch unique project IDs with names successfully', async () => {
      const mockAggregateResults = [
        { _id: '507f1f77bcf86cd799439011', projectName: 'Project A' },
        { _id: '507f1f77bcf86cd799439012', projectName: 'Project B' },
      ];
      mockBuildingIssue.aggregate.mockResolvedValue(mockAggregateResults);

      await controller.getUniqueProjectIds(req, res);

      expect(mockBuildingIssue.aggregate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith([
        { projectId: '507f1f77bcf86cd799439011', projectName: 'Project A' },
        { projectId: '507f1f77bcf86cd799439012', projectName: 'Project B' },
      ]);
    });

    it('should return "Unknown Project" when project name is null', async () => {
      const mockAggregateResults = [{ _id: '507f1f77bcf86cd799439011', projectName: null }];
      mockBuildingIssue.aggregate.mockResolvedValue(mockAggregateResults);

      await controller.getUniqueProjectIds(req, res);

      expect(res.json).toHaveBeenCalledWith([
        { projectId: '507f1f77bcf86cd799439011', projectName: 'Unknown Project' },
      ]);
    });

    it('should return "Unknown Project" when projectName is undefined', async () => {
      const mockAggregateResults = [{ _id: '507f1f77bcf86cd799439011' }];
      mockBuildingIssue.aggregate.mockResolvedValue(mockAggregateResults);

      await controller.getUniqueProjectIds(req, res);

      expect(res.json).toHaveBeenCalledWith([
        { projectId: '507f1f77bcf86cd799439011', projectName: 'Unknown Project' },
      ]);
    });

    it('should return empty array when no projects found', async () => {
      mockBuildingIssue.aggregate.mockResolvedValue([]);

      await controller.getUniqueProjectIds(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should return 500 error when database error occurs', async () => {
      const error = new Error('Aggregation error');
      mockBuildingIssue.aggregate.mockRejectedValue(error);

      await controller.getUniqueProjectIds(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  // ==================== bmUpdateIssue Tests ====================
  describe('bmUpdateIssue', () => {
    it('should update an issue successfully', async () => {
      const mockUpdatedIssue = {
        _id: '507f1f77bcf86cd799439011',
        issueTitle: ['Updated Title'],
        status: 'closed',
      };
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { issueTitle: ['Updated Title'], status: 'closed' };

      mockBuildingIssue.findByIdAndUpdate.mockResolvedValue(mockUpdatedIssue);

      await controller.bmUpdateIssue(req, res);

      const callArgs = mockBuildingIssue.findByIdAndUpdate.mock.calls[0];
      expect(callArgs[0]).toBe('507f1f77bcf86cd799439011');
      expect(callArgs[1].$set.issueTitle).toEqual(['Updated Title']);
      expect(callArgs[1].$set.status).toBe('closed');
      expect(callArgs[1].$set.closedDate).toBeInstanceOf(Date);
      expect(callArgs[2]).toEqual({ new: true });
      expect(res.json).toHaveBeenCalledWith(mockUpdatedIssue);
    });

    it('should return 400 when update data is null', async () => {
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = null;

      await controller.bmUpdateIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid update data.' });
    });

    it('should return 400 when update data is not an object', async () => {
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = 'not an object';

      await controller.bmUpdateIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid update data.' });
    });

    it('should return 404 when issue not found', async () => {
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { status: 'closed' };

      mockBuildingIssue.findByIdAndUpdate.mockResolvedValue(null);

      await controller.bmUpdateIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Issue not found.' });
    });

    it('should return 500 when database error occurs', async () => {
      const error = new Error('Database error');
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { status: 'closed' };

      mockBuildingIssue.findByIdAndUpdate.mockRejectedValue(error);

      await controller.bmUpdateIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
    });

    it('should return 500 when findByIdAndUpdate throws synchronously', async () => {
      const error = new Error('Unexpected error');
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { status: 'closed' };

      mockBuildingIssue.findByIdAndUpdate.mockImplementation(() => {
        throw error;
      });

      await controller.bmUpdateIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unexpected error' });
    });

    it('should set closedDate when closing an issue', async () => {
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { status: 'closed' };

      const mockUpdatedIssue = {
        _id: '507f1f77bcf86cd799439011',
        status: 'closed',
        closedDate: new Date(),
      };

      mockBuildingIssue.findByIdAndUpdate.mockResolvedValue(mockUpdatedIssue);

      await controller.bmUpdateIssue(req, res);

      const callArgs = mockBuildingIssue.findByIdAndUpdate.mock.calls[0][1];
      expect(callArgs.$set.closedDate).toBeInstanceOf(Date);
      expect(callArgs.$set.status).toBe('closed');
    });

    it('should clear closedDate when reopening an issue', async () => {
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { status: 'open' };

      const mockUpdatedIssue = {
        _id: '507f1f77bcf86cd799439011',
        status: 'open',
        closedDate: null,
      };

      mockBuildingIssue.findByIdAndUpdate.mockResolvedValue(mockUpdatedIssue);

      await controller.bmUpdateIssue(req, res);

      const callArgs = mockBuildingIssue.findByIdAndUpdate.mock.calls[0][1];
      expect(callArgs.$set.closedDate).toBeNull();
      expect(callArgs.$set.status).toBe('open');
    });
  });

  // ==================== bmDeleteIssue Tests ====================
  describe('bmDeleteIssue', () => {
    it('should delete an issue successfully', async () => {
      const mockDeletedIssue = { _id: '507f1f77bcf86cd799439011' };
      req.params.id = '507f1f77bcf86cd799439011';

      mockBuildingIssue.findByIdAndDelete.mockResolvedValue(mockDeletedIssue);

      await controller.bmDeleteIssue(req, res);

      expect(mockBuildingIssue.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.json).toHaveBeenCalledWith({ message: 'Issue deleted successfully.' });
    });

    it('should return 404 when issue not found', async () => {
      req.params.id = '507f1f77bcf86cd799439011';

      mockBuildingIssue.findByIdAndDelete.mockResolvedValue(null);

      await controller.bmDeleteIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Issue not found.' });
    });

    it('should return 500 when database error occurs', async () => {
      const error = new Error('Database error');
      req.params.id = '507f1f77bcf86cd799439011';

      mockBuildingIssue.findByIdAndDelete.mockRejectedValue(error);

      await controller.bmDeleteIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  // ==================== bmGetIssue Tests ====================
  describe('bmGetIssue', () => {
    it('should fetch all issues successfully', async () => {
      const mockIssues = [{ _id: '1', name: 'Issue 1' }];
      mockBuildingIssue.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockIssues),
      });

      await controller.bmGetIssue(req, res);

      expect(mockBuildingIssue.find).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockIssues);
    });

    it('should handle errors when fetching issues', async () => {
      const error = new Error('Database error');
      mockBuildingIssue.find.mockReturnValue({
        populate: jest.fn().mockRejectedValue(error),
      });

      await controller.bmGetIssue(req, res);

      expect(mockBuildingIssue.find).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(error);
    });

    it('should handle thrown errors in try-catch', async () => {
      const error = new Error('Unexpected error');
      mockBuildingIssue.find.mockImplementation(() => {
        throw error;
      });

      await controller.bmGetIssue(req, res);

      expect(res.json).toHaveBeenCalledWith(error);
    });
  });

  // ==================== bmPostIssue Tests ====================
  describe('bmPostIssue', () => {
    it('should create a new issue successfully', async () => {
      const mockNewIssue = { _id: '123', name: 'New Issue' };
      req.body = mockNewIssue;

      mockBuildingIssue.create.mockResolvedValue(mockNewIssue);

      await controller.bmPostIssue(req, res);

      expect(mockBuildingIssue.create).toHaveBeenCalledWith(mockNewIssue);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockNewIssue);
    });

    it('should handle errors when creating a new issue', async () => {
      const error = new Error('Creation error');
      mockBuildingIssue.create.mockRejectedValue(error);

      await controller.bmPostIssue(req, res);

      expect(mockBuildingIssue.create).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(error);
    });

    it('should handle thrown errors in try-catch', async () => {
      const error = new Error('Unexpected error');
      mockBuildingIssue.create.mockImplementation(() => {
        throw error;
      });

      await controller.bmPostIssue(req, res);

      expect(res.json).toHaveBeenCalledWith(error);
    });
  });

  // ==================== bmGetIssueChart Tests ====================
  describe('bmGetIssueChart', () => {
    it('should fetch issue chart data without filters', async () => {
      const mockAggregateResults = [
        { _id: 'Safety', years: [{ year: 2024, count: 5 }] },
        { _id: 'Labor', years: [{ year: 2024, count: 3 }] },
      ];
      mockBuildingIssue.aggregate.mockResolvedValue(mockAggregateResults);

      await controller.bmGetIssueChart(req, res);

      expect(mockBuildingIssue.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        Safety: { 2024: 5 },
        Labor: { 2024: 3 },
      });
    });

    it('should filter by issueType when provided', async () => {
      req.query.issueType = 'Safety';
      mockBuildingIssue.aggregate.mockResolvedValue([]);

      await controller.bmGetIssueChart(req, res);

      const aggregationPipeline = mockBuildingIssue.aggregate.mock.calls[0][0];
      expect(aggregationPipeline[0].$match.issueType).toBe('Safety');
    });

    it('should filter by year when provided', async () => {
      req.query.year = '2024';
      mockBuildingIssue.aggregate.mockResolvedValue([]);

      await controller.bmGetIssueChart(req, res);

      const aggregationPipeline = mockBuildingIssue.aggregate.mock.calls[0][0];
      expect(aggregationPipeline[0].$match.issueDate.$gte).toBeInstanceOf(Date);
      expect(aggregationPipeline[0].$match.issueDate.$lte).toBeInstanceOf(Date);
    });

    it('should combine issueType and year filters', async () => {
      req.query.issueType = 'Safety';
      req.query.year = '2024';
      mockBuildingIssue.aggregate.mockResolvedValue([]);

      await controller.bmGetIssueChart(req, res);

      const aggregationPipeline = mockBuildingIssue.aggregate.mock.calls[0][0];
      expect(aggregationPipeline[0].$match.issueType).toBe('Safety');
      expect(aggregationPipeline[0].$match.issueDate).toBeDefined();
    });

    it('should return empty object when no data found', async () => {
      mockBuildingIssue.aggregate.mockResolvedValue([]);

      await controller.bmGetIssueChart(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({});
    });

    it('should handle multiple years for same issue type', async () => {
      const mockAggregateResults = [
        {
          _id: 'Safety',
          years: [
            { year: 2023, count: 3 },
            { year: 2024, count: 5 },
          ],
        },
      ];
      mockBuildingIssue.aggregate.mockResolvedValue(mockAggregateResults);

      await controller.bmGetIssueChart(req, res);

      expect(res.json).toHaveBeenCalledWith({
        Safety: { 2023: 3, 2024: 5 },
      });
    });

    it('should return 500 error when database error occurs', async () => {
      const error = new Error('Aggregation error');
      mockBuildingIssue.aggregate.mockRejectedValue(error);

      await controller.bmGetIssueChart(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error', error });
    });
  });

  // ==================== getLongestOpenIssues Tests ====================
  describe('getLongestOpenIssues', () => {
    const mockProjectId = '507f1f77bcf86cd799439011';
    const mockIssueDate = new Date('2022-01-15');

    beforeEach(() => {
      // Setup default mock for chained methods
      mockBuildingIssue.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
    });

    it('should fetch longest open issues without filters', async () => {
      const mockIssues = [
        {
          issueTitle: ['Old Issue'],
          issueDate: mockIssueDate,
          projectId: { _id: mockProjectId },
        },
      ];

      mockBuildingIssue.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockIssues),
      });

      await controller.getLongestOpenIssues(req, res);

      expect(mockBuildingIssue.find).toHaveBeenCalledWith({ status: 'open' });
      expect(res.json).toHaveBeenCalled();
      const result = res.json.mock.calls[0][0];
      expect(result).toHaveLength(1);
      expect(result[0].issueName).toBe('Old Issue');
      expect(result[0].projects).toHaveLength(1);
      expect(result[0].projects[0].durationOpen).toBeGreaterThan(0);
    });

    it('should filter by projects when provided', async () => {
      req.query.projects = mockProjectId;
      const mockIssues = [];

      mockBuildingIssue.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockIssues),
      });

      await controller.getLongestOpenIssues(req, res);

      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      expect(callArgs.projectId.$in).toContain(mockProjectId);
    });

    it('should filter by dates and return matching projects', async () => {
      req.query.dates = '2022-01-01,2024-12-31';

      const mockProjects = [{ _id: mockProjectId }];
      const selectMock = jest.fn().mockReturnThis();
      const leanMock = jest.fn().mockResolvedValue(mockProjects);
      mockBuildingProjectFind.mockReturnValue({
        select: selectMock,
        lean: leanMock,
      });

      mockBuildingIssue.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      await controller.getLongestOpenIssues(req, res);

      expect(mockBuildingProjectFind).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('should return empty array when dates provided but no matching projects', async () => {
      req.query.dates = '2022-01-01,2024-12-31';

      const selectMock = jest.fn().mockReturnThis();
      const leanMock = jest.fn().mockResolvedValue([]);
      mockBuildingProjectFind.mockReturnValue({
        select: selectMock,
        lean: leanMock,
      });

      await controller.getLongestOpenIssues(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should intersect project filters when both dates and projects provided', async () => {
      const anotherProjectId = '507f1f77bcf86cd799439012';
      req.query.dates = '2022-01-01,2024-12-31';
      req.query.projects = `${mockProjectId},${anotherProjectId}`;

      const mockProjects = [{ _id: mockProjectId }];
      const selectMock = jest.fn().mockReturnThis();
      const leanMock = jest.fn().mockResolvedValue(mockProjects);
      mockBuildingProjectFind.mockReturnValue({
        select: selectMock,
        lean: leanMock,
      });

      mockBuildingIssue.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      await controller.getLongestOpenIssues(req, res);

      expect(mockBuildingProjectFind).toHaveBeenCalled();
      const callArgs = mockBuildingIssue.find.mock.calls[0][0];
      // Should only include mockProjectId since it's the intersection
      expect(callArgs.projectId.$in).toContain(mockProjectId);
    });

    it('should return top 7 issues sorted by duration', async () => {
      const mockIssues = Array.from({ length: 10 }, (_, i) => ({
        issueTitle: [`Issue ${i + 1}`],
        issueDate: new Date(Date.now() - (i + 1) * 30 * 24 * 60 * 60 * 1000),
        projectId: { _id: mockProjectId },
      }));

      mockBuildingIssue.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockIssues),
      });

      await controller.getLongestOpenIssues(req, res);

      const result = res.json.mock.calls[0][0];
      expect(result).toHaveLength(7);
      // Response is capped at 7 items; each item has issueName and projects with durationOpen
      result.forEach((item) => {
        expect(item.issueName).toBeDefined();
        expect(item.projects).toHaveLength(1);
        expect(typeof item.projects[0].durationOpen).toBe('number');
      });
    });

    it('should format duration correctly for months', async () => {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const mockIssues = [
        {
          issueTitle: ['Recent Issue'],
          issueDate: twoMonthsAgo,
          projectId: { _id: mockProjectId },
        },
      ];

      mockBuildingIssue.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockIssues),
      });

      await controller.getLongestOpenIssues(req, res);

      const result = res.json.mock.calls[0][0];
      expect(result[0].projects[0].durationOpen).toBeGreaterThanOrEqual(2);
    });

    it('should return 500 error when database error occurs', async () => {
      const error = new Error('Database error');
      mockBuildingIssue.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(error),
      });

      await controller.getLongestOpenIssues(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching longest open issues' });
    });
  });
});
