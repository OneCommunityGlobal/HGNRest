// 1. Define the mock function
const mockAggregate = jest.fn();

// 2. Mock the module using an implicit return (no braces, wrapped in parens)
jest.mock('../../models/materialUsage', () => ({
  aggregate: (...args) => mockAggregate(...args),
}));

// 3. Import the controller and model
const { getMaterialUtilization } = require('../materialUtilizationController');

describe('Material Utilization Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    req = {
      query: {
        start: '2025-11-01',
        end: '2026-01-07',
        projects: ['6541c4001111111111111111'],
        materials: [],
      },
    };
  });

  describe('getMaterialUtilization', () => {
    it('should return 200 and data when valid parameters are provided', async () => {
      const mockData = [{ project: 'Project Alpha', used: 80, unused: 20, totalHandled: 100 }];

      // Use the defined mockAggregate function
      mockAggregate.mockResolvedValue(mockData);

      await getMaterialUtilization(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockData);
    });

    it('should return 400 if start or end date is missing', async () => {
      req.query.start = '';
      await getMaterialUtilization(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if no records match the criteria', async () => {
      mockAggregate.mockResolvedValue([]);

      await getMaterialUtilization(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it('should return 500 if the database aggregation fails', async () => {
      mockAggregate.mockRejectedValue(new Error('Aggregation Failed'));

      await getMaterialUtilization(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Server Error',
        }),
      );
    });
  });
});
