const bmIssueController = require('../bmIssueController');

// Mocking the BuildingIssue Model
const mockBuildingIssue = {
  find: jest.fn(),
  create: jest.fn(),
};

describe('Building Issue Controller', () => {
  let controller;
  let req;
  let res;

  beforeEach(() => {
    controller = bmIssueController(mockBuildingIssue);

    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
  });

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
  });

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
  });
});
