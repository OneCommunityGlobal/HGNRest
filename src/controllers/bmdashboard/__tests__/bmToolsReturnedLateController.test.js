// Version 1.0.0
const mockToolReturnFind = jest.fn();
const mockToolReturnDistinct = jest.fn();
const mockProjectFind = jest.fn();

jest.mock('mongoose', () => {
  const ObjectId = jest.fn((value) => `oid:${value}`);
  ObjectId.isValid = jest.fn();

  return {
    disconnect: jest.fn().mockResolvedValue(undefined),
    Types: {
      ObjectId,
    },
  };
});

jest.mock('../../../models/bmdashboard/toolReturn', () => ({
  find: mockToolReturnFind,
  distinct: mockToolReturnDistinct,
}));

jest.mock('../../../models/project', () => ({
  find: mockProjectFind,
}));

const mongoose = require('mongoose');
const bmToolsReturnedLateController = require('../bmToolsReturnedLateController');

describe('bmToolsReturnedLateController', () => {
  let controller;
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    mockToolReturnDistinct.mockResolvedValue([]);
    controller = bmToolsReturnedLateController();
    req = { query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('rejects non-string projectId query values', async () => {
    req.query = {
      projectId: { $ne: null },
    };

    await controller.getToolsReturnedLate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid projectId format.',
    });
    expect(mockToolReturnFind).not.toHaveBeenCalled();
  });

  it('rejects non-string tools query values', async () => {
    req.query = {
      tools: { $in: ['Hammer'] },
    };

    await controller.getToolsReturnedLate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid tools value.',
    });
    expect(mockToolReturnFind).not.toHaveBeenCalled();
  });

  it('builds the database query from validated primitive inputs only', async () => {
    const validProjectId = '507f1f77bcf86cd799439011';
    const records = [
      {
        toolName: 'Hammer',
        projectId: { toString: () => validProjectId },
        totalReturns: 4,
        returnedLate: 1,
      },
    ];

    mongoose.Types.ObjectId.isValid.mockReturnValue(true);
    mockToolReturnFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue(records),
    });
    mockProjectFind.mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([{ _id: { toString: () => validProjectId }, projectName: 'Alpha' }]),
    });

    req.query = {
      projectId: validProjectId,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      tools: 'Hammer,Drill',
    };

    await controller.getToolsReturnedLate(req, res);

    expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith(validProjectId);
    expect(mockToolReturnFind).toHaveBeenCalledWith({
      projectId: expect.any(mongoose.Types.ObjectId),
      date: {
        $gte: new Date('2026-01-01'),
        $lte: new Date('2026-01-31'),
      },
      toolName: { $in: ['Hammer', 'Drill'] },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 1,
      data: [
        {
          toolName: 'Hammer',
          projectId: validProjectId,
          projectName: 'Alpha',
          totalReturns: 4,
          lateReturns: 1,
          percentLate: 25,
        },
      ],
      message: 'Found 1 tools with rental data',
    });
  });
  it('keeps orphan project names and rates consistent across project, date and tool filters', async () => {
    const ids = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
    const records = ids.map((projectId, i) => ({
      projectId,
      toolName: 'Drill',
      totalReturns: 10,
      returnedLate: i + 1,
    }));
    mockToolReturnDistinct.mockResolvedValue([...ids].reverse());
    mockProjectFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    mongoose.Types.ObjectId.isValid.mockReturnValue(true);
    mockToolReturnFind.mockReturnValue({ lean: jest.fn().mockResolvedValue(records) });
    await controller.getToolsReturnedLate(req, res);
    const all = res.json.mock.calls[0][0].data;
    res.json.mockClear();
    await controller.getAvailableProjects(req, res);
    const projects = res.json.mock.calls[0][0].data;
    for (const projectId of ids) {
      res.json.mockClear();
      req.query = { projectId, tools: 'Drill', startDate: '2026-01-01' };
      mockToolReturnFind.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue(records.filter((record) => record.projectId === projectId)),
      });
      await controller.getToolsReturnedLate(req, res);
      const selected = res.json.mock.calls[0][0].data[0];
      expect(selected).toEqual(all.find((record) => record.projectId === projectId));
      expect(selected.projectName).toBe(
        projects.find((project) => project.projectId === projectId).projectName,
      );
    }
    expect(projects.map((project) => project.projectName)).toEqual(['Project 1', 'Project 2']);
  });
});
