jest.mock('../models/task', () => ({
  find: jest.fn(),
}));

jest.mock('../models/wbs', () => ({
  find: jest.fn(),
}));

jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

const task = require('../models/task');
const wbs = require('../models/wbs');
const logger = require('../startup/logger');
const projectController = require('./projectController');

describe('getProjectsCommittedHours', () => {
  let Project;
  let getProjectsCommittedHours;
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    Project = {
      find: jest.fn(),
    };

    ({ getProjectsCommittedHours } = projectController(Project));

    req = {
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  test('returns committed hours totals for projects with tasks', async () => {
    const projects = [
      { _id: 'project-1', projectName: 'Project Alpha' },
      { _id: 'project-2', projectName: 'Project Beta' },
    ];

    Project.find.mockResolvedValue(projects);

    wbs.find
      .mockResolvedValueOnce([{ _id: 'wbs-1' }, { _id: 'wbs-2' }])
      .mockResolvedValueOnce([{ _id: 'wbs-3' }]);

    task.find
      .mockResolvedValueOnce([
        { estimatedHours: 5 },
        { estimatedHours: 7.5 },
        { estimatedHours: 2 },
      ])
      .mockResolvedValueOnce([{ estimatedHours: 10 }, { estimatedHours: 4 }]);

    await getProjectsCommittedHours(req, res);

    expect(Project.find).toHaveBeenCalledWith({ isArchived: { $ne: true } }, '_id projectName');

    expect(wbs.find).toHaveBeenNthCalledWith(1, { projectId: 'project-1' }, '_id');
    expect(wbs.find).toHaveBeenNthCalledWith(2, { projectId: 'project-2' }, '_id');

    expect(task.find).toHaveBeenNthCalledWith(
      1,
      { wbsId: { $in: ['wbs-1', 'wbs-2'] } },
      'estimatedHours',
    );
    expect(task.find).toHaveBeenNthCalledWith(2, { wbsId: { $in: ['wbs-3'] } }, 'estimatedHours');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        committedHours: 14.5,
      },
      {
        projectId: 'project-2',
        projectName: 'Project Beta',
        committedHours: 14,
      },
    ]);
  });

  test('applies all three date conditions when both dates are provided', async () => {
    req.body = {
      fromDate: '2026-01-10',
      toDate: '2026-01-20',
    };

    Project.find.mockResolvedValue([{ _id: 'project-1', projectName: 'Project Alpha' }]);
    wbs.find.mockResolvedValue([{ _id: 'wbs-1' }]);
    task.find.mockResolvedValue([{ estimatedHours: 8 }]);

    await getProjectsCommittedHours(req, res);

    const expectedStart = new Date('2026-01-10');
    const expectedEnd = new Date('2026-01-20');
    expectedEnd.setHours(23, 59, 59, 999);

    expect(task.find).toHaveBeenCalledWith(
      {
        wbsId: { $in: ['wbs-1'] },
        $or: [
          {
            startedDatetime: { $lte: expectedEnd },
            dueDatetime: { $gte: expectedStart },
          },
          {
            startedDatetime: {
              $gte: expectedStart,
              $lte: expectedEnd,
            },
          },
          {
            dueDatetime: {
              $gte: expectedStart,
              $lte: expectedEnd,
            },
          },
        ],
      },
      'estimatedHours',
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        committedHours: 8,
      },
    ]);
  });

  test('does not apply date conditions when dates are absent', async () => {
    Project.find.mockResolvedValue([{ _id: 'project-1', projectName: 'Project Alpha' }]);
    wbs.find.mockResolvedValue([{ _id: 'wbs-1' }]);
    task.find.mockResolvedValue([{ estimatedHours: 6 }]);

    await getProjectsCommittedHours(req, res);

    expect(task.find).toHaveBeenCalledWith({ wbsId: { $in: ['wbs-1'] } }, 'estimatedHours');
  });

  test('returns zero committed hours when a project has no WBS records', async () => {
    Project.find.mockResolvedValue([{ _id: 'project-1', projectName: 'Project Alpha' }]);
    wbs.find.mockResolvedValue([]);
    task.find.mockResolvedValue([]);

    await getProjectsCommittedHours(req, res);

    expect(task.find).toHaveBeenCalledWith({ wbsId: { $in: [] } }, 'estimatedHours');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        committedHours: 0,
      },
    ]);
  });

  test('returns zero committed hours when no tasks exist', async () => {
    Project.find.mockResolvedValue([{ _id: 'project-1', projectName: 'Project Alpha' }]);
    wbs.find.mockResolvedValue([{ _id: 'wbs-1' }]);
    task.find.mockResolvedValue([]);

    await getProjectsCommittedHours(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        committedHours: 0,
      },
    ]);
  });

  test('treats missing estimatedHours as zero', async () => {
    Project.find.mockResolvedValue([{ _id: 'project-1', projectName: 'Project Alpha' }]);
    wbs.find.mockResolvedValue([{ _id: 'wbs-1' }]);
    task.find.mockResolvedValue([{ estimatedHours: 5 }, {}, { estimatedHours: null }]);

    await getProjectsCommittedHours(req, res);

    expect(res.send).toHaveBeenCalledWith([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        committedHours: 5,
      },
    ]);
  });

  test('returns an empty array when there are no projects', async () => {
    Project.find.mockResolvedValue([]);

    await getProjectsCommittedHours(req, res);

    expect(wbs.find).not.toHaveBeenCalled();
    expect(task.find).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([]);
  });

  test('returns HTTP 500 and logs the exception when fetching projects fails', async () => {
    const error = new Error('Database unavailable');
    Project.find.mockRejectedValue(error);

    await getProjectsCommittedHours(req, res);

    expect(logger.logException).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error fetching project committed hours.');
  });

  test('returns HTTP 500 when fetching WBS records fails', async () => {
    const error = new Error('WBS query failed');

    Project.find.mockResolvedValue([{ _id: 'project-1', projectName: 'Project Alpha' }]);
    wbs.find.mockRejectedValue(error);

    await getProjectsCommittedHours(req, res);

    expect(logger.logException).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error fetching project committed hours.');
  });

  test('returns HTTP 500 when fetching tasks fails', async () => {
    const error = new Error('Task query failed');

    Project.find.mockResolvedValue([{ _id: 'project-1', projectName: 'Project Alpha' }]);
    wbs.find.mockResolvedValue([{ _id: 'wbs-1' }]);
    task.find.mockRejectedValue(error);

    await getProjectsCommittedHours(req, res);

    expect(logger.logException).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error fetching project committed hours.');
  });
});
