jest.mock('../../models/toolReplacement', () => ({
  find: jest.fn(),
}));

const mongoose = require('mongoose');
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

const createQueryChain = (results) => {
  const chain = {
    setOptions: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    equals: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(results),
  };
  ToolReplacement.find.mockReturnValue(chain);
  return chain;
};

describe('toolReplacementController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = toolReplacementController();
  });

  describe('getToolReplacement', () => {
    it('returns tools sorted by requirementSatisfiedPercentage ascending with projectName', async () => {
      const mockData = [
        {
          _id: '1',
          toolName: 'Hammer',
          requirementSatisfiedPercentage: 20,
          projectId: { _id: VALID_PROJECT_ID, name: 'Building 1' },
          date: new Date('2025-06-15'),
        },
        {
          _id: '2',
          toolName: 'Drill',
          requirementSatisfiedPercentage: 45,
          projectId: { _id: VALID_PROJECT_ID, name: 'Building 1' },
          date: new Date('2025-06-15'),
        },
      ];
      const chain = createQueryChain(mockData);
      const req = makeReq();
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(ToolReplacement.find).toHaveBeenCalledWith();
      expect(chain.setOptions).toHaveBeenCalledWith({ sanitizeFilter: true });
      expect(chain.populate).toHaveBeenCalledWith('projectId', 'name');
      expect(chain.sort).toHaveBeenCalledWith({
        requirementSatisfiedPercentage: 1,
        toolName: 1,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        {
          _id: '1',
          toolName: 'Hammer',
          requirementSatisfiedPercentage: 20,
          projectId: VALID_PROJECT_ID,
          projectName: 'Building 1',
          date: mockData[0].date,
        },
        {
          _id: '2',
          toolName: 'Drill',
          requirementSatisfiedPercentage: 45,
          projectId: VALID_PROJECT_ID,
          projectName: 'Building 1',
          date: mockData[1].date,
        },
      ]);
    });

    it('filters by date range, tools, and projectId using chained where()', async () => {
      const chain = createQueryChain([]);
      const req = makeReq({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        tools: 'Hammer, Drill',
        projectId: VALID_PROJECT_ID,
      });
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(chain.where).toHaveBeenCalledWith('date');
      expect(chain.gte).toHaveBeenCalledWith(new Date('2024-01-01'));
      expect(chain.lte).toHaveBeenCalledWith(new Date('2024-01-31'));
      expect(chain.where).toHaveBeenCalledWith('toolName');
      expect(chain.in).toHaveBeenCalledWith(['Hammer', 'Drill']);
      expect(chain.where).toHaveBeenCalledWith('projectId');
      expect(chain.equals).toHaveBeenCalledWith(expect.any(mongoose.Types.ObjectId));
      expect(chain.equals.mock.calls[0][0].toString()).toBe(VALID_PROJECT_ID);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('ignores non-string query params to prevent NoSQL injection', async () => {
      const chain = createQueryChain([]);
      const req = makeReq({
        tools: { $gt: '' },
        projectId: { $ne: null },
        startDate: { $gt: '2020-01-01' },
      });
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(chain.where).not.toHaveBeenCalled();
      expect(chain.lean).toHaveBeenCalled();
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
        setOptions: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        equals: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const req = makeReq();
      const res = makeRes();

      await controller.getToolReplacement(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });
});
