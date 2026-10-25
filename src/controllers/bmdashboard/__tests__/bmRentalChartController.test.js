const mockRentalFind = jest.fn();
const mockRentalAggregate = jest.fn();
const mockBuildingProjectFind = jest.fn();

jest.mock('mongoose', () => {
  const ObjectId = jest.fn((value) => `oid:${value}`);
  ObjectId.isValid = jest.fn();

  return {
    Types: {
      ObjectId,
    },
  };
});

jest.mock('../../../models/bmdashboard/buildingRentalChart', () => ({
  find: mockRentalFind,
  aggregate: mockRentalAggregate,
}));

jest.mock('../../../models/bmdashboard/buildingProject', () => ({
  find: mockBuildingProjectFind,
}));

const mongoose = require('mongoose');
const bmRentalChartController = require('../bmRentalChartController');

const VALID_PROJECT_ID = '507f1f77bcf86cd799439011';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe('bmRentalChartController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = bmRentalChartController();
  });

  describe('getAllRentalCosts', () => {
    it('returns all rental costs', async () => {
      const rentals = [
        {
          projectId: VALID_PROJECT_ID,
          date: new Date('2024-01-01'),
          toolName: 'Hammer',
          rentalCost: 100,
          totalMaterialCost: 250,
        },
      ];

      const exec = jest.fn().mockResolvedValue(rentals);
      const lean = jest.fn().mockReturnValue({ exec });
      const select = jest.fn().mockReturnValue({ lean });

      mockRentalFind.mockReturnValue({ select });

      const req = {};
      const res = makeRes();

      await controller.getAllRentalCosts(req, res);

      expect(mockRentalFind).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: rentals,
      });
    });

    it('returns 500 when fetching rental costs fails', async () => {
      const exec = jest.fn().mockRejectedValue(new Error('DB failure'));
      const lean = jest.fn().mockReturnValue({ exec });
      const select = jest.fn().mockReturnValue({ lean });

      mockRentalFind.mockReturnValue({ select });

      const req = {};
      const res = makeRes();

      await controller.getAllRentalCosts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server error DB failure',
      });
    });
  });

  describe('getRentalCostOverTime', () => {
    it('returns 400 for an invalid projectId', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      const req = {
        query: {
          projectId: 'invalid-id',
        },
      };
      const res = makeRes();

      await controller.getRentalCostOverTime(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid projectId',
      });
      expect(mockRentalAggregate).not.toHaveBeenCalled();
    });

    it('aggregates rental costs without filters', async () => {
      const result = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 200 },
      ];

      mockRentalAggregate.mockResolvedValue(result);

      const req = { query: {} };
      const res = makeRes();

      await controller.getRentalCostOverTime(req, res);

      expect(mockRentalAggregate).toHaveBeenCalledWith([
        { $match: {} },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date',
              },
            },
            value: {
              $sum: '$rentalCost',
            },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            value: 1,
          },
        },
      ]);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('filters rental costs by projectId', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(true);
      mockRentalAggregate.mockResolvedValue([]);

      const req = {
        query: {
          projectId: VALID_PROJECT_ID,
        },
      };
      const res = makeRes();

      await controller.getRentalCostOverTime(req, res);

      const pipeline = mockRentalAggregate.mock.calls[0][0];

      expect(pipeline[0]).toEqual({
        $match: {
          projectId: {
            $in: [VALID_PROJECT_ID, expect.any(mongoose.Types.ObjectId)],
          },
        },
      });

      expect(mongoose.Types.ObjectId).toHaveBeenCalledWith(VALID_PROJECT_ID);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('filters rental costs by start and end date', async () => {
      mockRentalAggregate.mockResolvedValue([]);

      const req = {
        query: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      };
      const res = makeRes();

      await controller.getRentalCostOverTime(req, res);

      const pipeline = mockRentalAggregate.mock.calls[0][0];
      const match = pipeline[0].$match;

      expect(match.date.$gte).toEqual(new Date('2024-01-01'));

      const expectedEnd = new Date('2024-01-31');
      expectedEnd.setUTCHours(23, 59, 59, 999);

      expect(match.date.$lte).toEqual(expectedEnd);
    });

    it('returns 500 when aggregation fails', async () => {
      mockRentalAggregate.mockRejectedValue(new Error('Aggregation failed'));

      const req = { query: {} };
      const res = makeRes();

      await controller.getRentalCostOverTime(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server error Aggregation failed',
      });
    });
  });

  describe('getToolsCostBreakdown', () => {
    it('returns 400 when one of the project IDs is invalid', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(true).mockReturnValueOnce(false);

      const req = {
        query: {
          projects: `${VALID_PROJECT_ID},invalid-id`,
        },
      };
      const res = makeRes();

      await controller.getToolsCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'One or more project IDs are invalid',
      });
      expect(mockRentalAggregate).not.toHaveBeenCalled();
    });

    it('filters by multiple project IDs', async () => {
      const secondProjectId = '507f191e810c19729de860ea';

      mongoose.Types.ObjectId.isValid.mockReturnValue(true);
      mockRentalAggregate.mockResolvedValue([]);

      mockBuildingProjectFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const req = {
        query: {
          projects: `${VALID_PROJECT_ID},${secondProjectId}`,
        },
      };
      const res = makeRes();

      await controller.getToolsCostBreakdown(req, res);

      const pipeline = mockRentalAggregate.mock.calls[0][0];

      expect(pipeline[0].$match.projectId).toEqual({
        $in: [
          VALID_PROJECT_ID,
          expect.any(mongoose.Types.ObjectId),
          secondProjectId,
          expect.any(mongoose.Types.ObjectId),
        ],
      });

      expect(mongoose.Types.ObjectId).toHaveBeenCalledWith(VALID_PROJECT_ID);
      expect(mongoose.Types.ObjectId).toHaveBeenCalledWith(secondProjectId);
    });

    it('filters tool costs by start and end date', async () => {
      mockRentalAggregate.mockResolvedValue([]);

      mockBuildingProjectFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const req = {
        query: {
          startDate: '2024-02-01',
          endDate: '2024-02-29',
        },
      };
      const res = makeRes();

      await controller.getToolsCostBreakdown(req, res);

      const pipeline = mockRentalAggregate.mock.calls[0][0];
      const match = pipeline[0].$match;

      expect(match.date.$gte).toEqual(new Date('2024-02-01'));

      const expectedEnd = new Date('2024-02-29');
      expectedEnd.setUTCHours(23, 59, 59, 999);

      expect(match.date.$lte).toEqual(expectedEnd);
    });

    it('returns owned and rented tool costs with project names', async () => {
      mockRentalAggregate.mockResolvedValue([
        {
          _id: VALID_PROJECT_ID,
          rentedToolsCost: 300,
          totalToolsCost: 1000,
        },
      ]);

      mongoose.Types.ObjectId.isValid.mockReturnValue(true);

      const projectIdObject = {
        toString: () => VALID_PROJECT_ID,
      };

      mockBuildingProjectFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: projectIdObject,
              name: 'Project 1',
            },
          ]),
        }),
      });

      const req = { query: {} };
      const res = makeRes();

      await controller.getToolsCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        {
          projectId: VALID_PROJECT_ID,
          projectName: 'Project 1',
          ownedToolsCost: 700,
          rentedToolsCost: 300,
        },
      ]);
    });

    it('uses Unknown Project when no project name is found', async () => {
      mockRentalAggregate.mockResolvedValue([
        {
          _id: VALID_PROJECT_ID,
          rentedToolsCost: 100,
          totalToolsCost: 400,
        },
      ]);

      mongoose.Types.ObjectId.isValid.mockReturnValue(true);

      mockBuildingProjectFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const req = { query: {} };
      const res = makeRes();

      await controller.getToolsCostBreakdown(req, res);

      expect(res.json).toHaveBeenCalledWith([
        {
          projectId: VALID_PROJECT_ID,
          projectName: 'Unknown Project',
          ownedToolsCost: 300,
          rentedToolsCost: 100,
        },
      ]);
    });

    it('never returns a negative owned tools cost', async () => {
      mockRentalAggregate.mockResolvedValue([
        {
          _id: VALID_PROJECT_ID,
          rentedToolsCost: 500,
          totalToolsCost: 300,
        },
      ]);

      mongoose.Types.ObjectId.isValid.mockReturnValue(true);

      mockBuildingProjectFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const req = { query: {} };
      const res = makeRes();

      await controller.getToolsCostBreakdown(req, res);

      expect(res.json).toHaveBeenCalledWith([
        {
          projectId: VALID_PROJECT_ID,
          projectName: 'Unknown Project',
          ownedToolsCost: 0,
          rentedToolsCost: 500,
        },
      ]);
    });

    it('returns 500 when tool cost aggregation fails', async () => {
      mockRentalAggregate.mockRejectedValue(new Error('Aggregation failed'));

      const req = { query: {} };
      const res = makeRes();

      await controller.getToolsCostBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server error Aggregation failed',
      });
    });
  });
});
