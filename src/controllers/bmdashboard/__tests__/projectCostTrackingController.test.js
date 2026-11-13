jest.mock('../../../models/bmdashboard/buildingProject', () => ({
  find: jest.fn(),
}));

const BuildingProject = require('../../../models/bmdashboard/buildingProject');
const projectCostTrackingController = require('../projectCostTrackingController');

const PROJECT_ID = '507f1f77bcf86cd799439011';
const OTHER_PROJECT_ID = '507f1f77bcf86cd799439012';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

const makeProjectCostTrackingModel = (entries) => ({
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(entries),
    }),
  }),
});

describe('projectCostTrackingController.getCostEntries', () => {
  let ProjectCostTracking;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with real project names, keeping plannedCost null when absent', async () => {
    const entries = [
      {
        projectId: PROJECT_ID,
        category: 'Labor',
        cost: 500,
        plannedCost: null,
        date: new Date('2024-01-05'),
      },
    ];
    ProjectCostTracking = makeProjectCostTrackingModel(entries);
    controller = projectCostTrackingController(ProjectCostTracking);
    BuildingProject.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: PROJECT_ID, name: 'Building 1' }]),
    });

    const req = { query: {} };
    const res = makeRes();
    await controller.getCostEntries(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        projectId: 'Building 1',
        category: 'Labor',
        actualCost: 500,
        plannedCost: null,
        date: '2024-01-05',
      },
    ]);
  });

  it('drops entries whose projectId no longer resolves to a real project', async () => {
    const entries = [
      {
        projectId: PROJECT_ID,
        category: 'Labor',
        cost: 100,
        plannedCost: null,
        date: new Date('2024-01-01'),
      },
      {
        projectId: OTHER_PROJECT_ID,
        category: 'Materials',
        cost: 200,
        plannedCost: 300,
        date: new Date('2024-01-02'),
      },
    ];
    ProjectCostTracking = makeProjectCostTrackingModel(entries);
    controller = projectCostTrackingController(ProjectCostTracking);
    BuildingProject.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: PROJECT_ID, name: 'Building 1' }]),
    });

    const req = { query: {} };
    const res = makeRes();
    await controller.getCostEntries(req, res);

    expect(res.json).toHaveBeenCalledWith([
      {
        projectId: 'Building 1',
        category: 'Labor',
        actualCost: 100,
        plannedCost: null,
        date: '2024-01-01',
      },
    ]);
  });

  it('applies valid projectId, category, and date range filters to the query', async () => {
    ProjectCostTracking = makeProjectCostTrackingModel([]);
    controller = projectCostTrackingController(ProjectCostTracking);
    BuildingProject.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const req = {
      query: {
        projectId: PROJECT_ID,
        category: 'Materials',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
      },
    };
    const res = makeRes();
    await controller.getCostEntries(req, res);

    expect(ProjectCostTracking.find).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      category: 'Materials',
      date: { $gte: new Date('2024-01-01'), $lte: new Date('2024-02-01') },
    });
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('ignores a NoSQL-injection-style projectId operator object instead of passing it through', async () => {
    ProjectCostTracking = makeProjectCostTrackingModel([]);
    controller = projectCostTrackingController(ProjectCostTracking);
    BuildingProject.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const req = { query: { projectId: { $ne: null } } };
    const res = makeRes();
    await controller.getCostEntries(req, res);

    expect(ProjectCostTracking.find).toHaveBeenCalledWith({});
  });

  it('ignores an unrecognized category value instead of passing it through', async () => {
    ProjectCostTracking = makeProjectCostTrackingModel([]);
    controller = projectCostTrackingController(ProjectCostTracking);
    BuildingProject.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const req = { query: { category: '$where' } };
    const res = makeRes();
    await controller.getCostEntries(req, res);

    expect(ProjectCostTracking.find).toHaveBeenCalledWith({});
  });

  it('ignores an unparsable date instead of passing an Invalid Date through', async () => {
    ProjectCostTracking = makeProjectCostTrackingModel([]);
    controller = projectCostTrackingController(ProjectCostTracking);
    BuildingProject.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const req = { query: { startDate: 'not-a-date' } };
    const res = makeRes();
    await controller.getCostEntries(req, res);

    expect(ProjectCostTracking.find).toHaveBeenCalledWith({ date: {} });
  });

  it('returns 500 on a database error', async () => {
    const error = new Error('DB failure');
    ProjectCostTracking = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(error),
        }),
      }),
    };
    controller = projectCostTrackingController(ProjectCostTracking);

    const req = { query: {} };
    const res = makeRes();
    await controller.getCostEntries(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: error.message });
  });
});
