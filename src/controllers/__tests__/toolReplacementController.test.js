jest.mock('../../models/toolReplacement', () => ({
  find: jest.fn(),
}));

const ToolReplacement = require('../../models/toolReplacement');
const toolReplacementController = require('../toolReplacementController');

const VALID_PROJECT_ID = '507f1f77bcf86cd799439011';

const makeReq = (query = {}) => ({ query });

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

const mockFindSort = (results) => {
  const sort = jest.fn().mockResolvedValue(results);
  ToolReplacement.find.mockReturnValue({ sort });
  return sort;
};

describe('toolReplacementController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = toolReplacementController();
  });

  describe('getToolReplacement', () => {
    it('returns tools sorted by requirementSatisfiedPercentage ascending', async () => {
      const mockData = [
        { toolName: 'Hammer', requirementSatisfiedPercentage: 20 },
        { toolName: 'Drill', requirementSatisfiedPercentage: 45 },
      ];
      const sort = mockFindSort(mockData);
      const req = makeReq();
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(ToolReplacement.find).toHaveBeenCalledWith({});
      expect(sort).toHaveBeenCalledWith({
        requirementSatisfiedPercentage: 1,
        toolName: 1,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockData);
    });

    it('filters by date range, tools, and projectId', async () => {
      const sort = mockFindSort([]);
      const req = makeReq({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        tools: 'Hammer, Drill',
        projectId: VALID_PROJECT_ID,
      });
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(ToolReplacement.find).toHaveBeenCalledWith({
        date: {
          $gte: new Date('2024-01-01'),
          $lte: new Date('2024-01-31'),
        },
        toolName: { $in: ['Hammer', 'Drill'] },
        projectId: VALID_PROJECT_ID,
      });
      expect(sort).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 400 for invalid startDate', async () => {
      const req = makeReq({ startDate: 'not-a-date' });
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid startDate' });
      expect(ToolReplacement.find).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid endDate', async () => {
      const req = makeReq({ startDate: '2024-01-01', endDate: 'bad-date' });
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid endDate' });
      expect(ToolReplacement.find).not.toHaveBeenCalled();
    });

    it('returns 400 when startDate is after endDate', async () => {
      const req = makeReq({ startDate: '2024-06-01', endDate: '2024-01-01' });
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid date range: startDate must be before endDate',
      });
      expect(ToolReplacement.find).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid projectId', async () => {
      const req = makeReq({ projectId: 'not-valid' });
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid projectId format' });
      expect(ToolReplacement.find).not.toHaveBeenCalled();
    });

    it('returns 500 when the query fails', async () => {
      ToolReplacement.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const req = makeReq();
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });
});
