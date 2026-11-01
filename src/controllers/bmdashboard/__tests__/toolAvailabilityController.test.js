const mongoose = require('mongoose');
const BuildingProject = require('../../../models/bmdashboard/buildingProject');
const toolAvailabilityController = require('../toolAvailabilityController');

const projectId = '65419e61105441587e2dec99';

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('Tool Availability Controller', () => {
  let ToolAvailability;
  let controller;

  beforeEach(() => {
    jest.restoreAllMocks();

    jest.spyOn(BuildingProject, 'find');

    ToolAvailability = {
      aggregate: jest.fn(),
      distinct: jest.fn(),
    };

    controller = toolAvailabilityController(ToolAvailability);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getToolsAvailability', () => {
    it('returns 400 for an invalid project ID', async () => {
      const req = { params: { id: 'invalid-id' }, query: {} };
      const res = makeResponse();

      await controller.getToolsAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid project ID format',
      });
      expect(ToolAvailability.aggregate).not.toHaveBeenCalled();
    });

    it('returns aggregated tool availability data', async () => {
      const data = [
        {
          toolName: 'Hammer',
          inUse: 5,
          needsReplacement: 2,
          yetToReceive: 1,
        },
      ];

      ToolAvailability.aggregate.mockResolvedValue(data);

      const req = { params: { id: projectId }, query: {} };
      const res = makeResponse();

      await controller.getToolsAvailability(req, res);

      expect(ToolAvailability.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: {
              projectId: new mongoose.Types.ObjectId(projectId),
            },
          }),
        ]),
      );
      expect(res.json).toHaveBeenCalledWith(data);
    });

    it('applies both start and end date filters', async () => {
      ToolAvailability.aggregate.mockResolvedValue([]);

      const req = {
        params: { id: projectId },
        query: {
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
      };
      const res = makeResponse();

      await controller.getToolsAvailability(req, res);

      const pipeline = ToolAvailability.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.date).toEqual({
        $gte: new Date('2026-01-01'),
        $lte: new Date('2026-01-31'),
      });
    });

    it('applies only the start date when end date is absent', async () => {
      ToolAvailability.aggregate.mockResolvedValue([]);

      const req = {
        params: { id: projectId },
        query: { startDate: '2026-01-01' },
      };
      const res = makeResponse();

      await controller.getToolsAvailability(req, res);

      const pipeline = ToolAvailability.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.date).toEqual({
        $gte: new Date('2026-01-01'),
      });
    });

    it('applies only the end date when start date is absent', async () => {
      ToolAvailability.aggregate.mockResolvedValue([]);

      const req = {
        params: { id: projectId },
        query: { endDate: '2026-01-31' },
      };
      const res = makeResponse();

      await controller.getToolsAvailability(req, res);

      const pipeline = ToolAvailability.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match.date).toEqual({
        $lte: new Date('2026-01-31'),
      });
    });

    it('returns an empty array when no data exists', async () => {
      ToolAvailability.aggregate.mockResolvedValue([]);

      const req = { params: { id: projectId }, query: {} };
      const res = makeResponse();

      await controller.getToolsAvailability(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('handles database aggregation failures', async () => {
      ToolAvailability.aggregate.mockRejectedValue(new Error('Database failure'));

      const req = { params: { id: projectId }, query: {} };
      const res = makeResponse();

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await controller.getToolsAvailability(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Internal server error',
        });
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('getUniqueProjectIds', () => {
    it('returns project names for valid project IDs', async () => {
      ToolAvailability.distinct.mockResolvedValue([new mongoose.Types.ObjectId(projectId)]);

      const projects = [
        {
          _id: new mongoose.Types.ObjectId(projectId),
          name: 'Building 1',
        },
      ];

      const query = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(projects),
      };

      BuildingProject.find.mockReturnValue(query);

      const req = {};
      const res = makeResponse();

      await controller.getUniqueProjectIds(req, res);

      expect(BuildingProject.find).toHaveBeenCalledWith({
        _id: {
          $in: [new mongoose.Types.ObjectId(projectId)],
        },
      });

      expect(res.json).toHaveBeenCalledWith([
        {
          projectId: projects[0]._id,
          projectName: 'Building 1',
        },
      ]);
    });

    it('returns an empty array when no project IDs exist', async () => {
      ToolAvailability.distinct.mockResolvedValue([]);

      const res = makeResponse();

      await controller.getUniqueProjectIds({}, res);

      expect(res.json).toHaveBeenCalledWith([]);
      expect(BuildingProject.find).not.toHaveBeenCalled();
    });

    it('ignores invalid project IDs', async () => {
      ToolAvailability.distinct.mockResolvedValue(['invalid-id']);

      const res = makeResponse();

      await controller.getUniqueProjectIds({}, res);

      expect(res.json).toHaveBeenCalledWith([]);
      expect(BuildingProject.find).not.toHaveBeenCalled();
    });

    it('handles project lookup failures', async () => {
      ToolAvailability.distinct.mockRejectedValue(new Error('Database failure'));

      const res = makeResponse();

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await controller.getUniqueProjectIds({}, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Internal server error',
        });
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});
