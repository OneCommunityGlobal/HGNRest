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

jest.mock('../utilities/permissions', () => ({
  ...jest.requireActual('../utilities/permissions'),
  hasPermission: jest.fn(),
}));

const logger = require('../startup/logger');
const { hasPermission } = require('../utilities/permissions');
const projectController = require('./projectController');

describe('getProjectsCommittedHours', () => {
  let Project;
  let getProjectsCommittedHours;
  let req;
  let res;

  const validDates = {
    fromDate: '2026-01-10',
    toDate: '2026-01-20',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);

    Project = {
      aggregate: jest.fn(),
    };

    ({ getProjectsCommittedHours } = projectController(Project));

    req = {
      body: {
        ...validDates,
        requestor: { userId: 'test-user' },
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  test('returns HTTP 403 when requestor does not have getReports permission', async () => {
    hasPermission.mockResolvedValue(false);

    await getProjectsCommittedHours(req, res);

    expect(hasPermission).toHaveBeenCalledWith(req.body.requestor, 'getReports');

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith(
      'You are not authorized to view volunteer hours reports.',
    );

    // Unauthorized requests must not execute the database aggregation.
    expect(Project.aggregate).not.toHaveBeenCalled();
  });

  test('returns actual logged hours for projects', async () => {
    Project.aggregate.mockResolvedValue([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        totalSeconds: 52200,
      },
      {
        projectId: 'project-2',
        projectName: 'Project Beta',
        totalSeconds: 36000,
      },
    ]);

    await getProjectsCommittedHours(req, res);

    expect(Project.aggregate).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        loggedHours: 14.5,
      },
      {
        projectId: 'project-2',
        projectName: 'Project Beta',
        loggedHours: 10,
      },
    ]);
  });

  test('uses the requested date range and accepted entry types', async () => {
    Project.aggregate.mockResolvedValue([]);

    await getProjectsCommittedHours(req, res);

    const pipeline = Project.aggregate.mock.calls[0][0];

    expect(pipeline[0]).toEqual({
      $match: {
        isArchived: { $ne: true },
      },
    });

    const lookup = pipeline.find((stage) => stage.$lookup)?.$lookup;
    const matchStage = lookup.pipeline.find((stage) => stage.$match);

    expect(matchStage.$match).toEqual({
      entryType: { $in: ['default', 'person', null] },
      dateOfWork: {
        $gte: '2026-01-10',
        $lte: '2026-01-20',
      },
      $expr: {
        $eq: ['$projectId', '$$projectId'],
      },
    });
  });

  test('includes projects with zero logged hours', async () => {
    Project.aggregate.mockResolvedValue([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        totalSeconds: 0,
      },
    ]);

    await getProjectsCommittedHours(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        loggedHours: 0,
      },
    ]);
  });

  test('rounds logged hours to one decimal place', async () => {
    Project.aggregate.mockResolvedValue([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        totalSeconds: 3700,
      },
    ]);

    await getProjectsCommittedHours(req, res);

    expect(res.send).toHaveBeenCalledWith([
      {
        projectId: 'project-1',
        projectName: 'Project Alpha',
        loggedHours: 1,
      },
    ]);
  });

  test('returns an empty array when there are no active projects', async () => {
    Project.aggregate.mockResolvedValue([]);

    await getProjectsCommittedHours(req, res);

    expect(Project.aggregate).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([]);
  });

  test.each([
    [{ fromDate: '2026-01-10' }, 'missing toDate'],
    [{ toDate: '2026-01-20' }, 'missing fromDate'],
    [{}, 'both dates missing'],
    [{ fromDate: 'invalid-date', toDate: '2026-01-20' }, 'invalid fromDate'],
    [{ fromDate: '2026-01-10', toDate: 'invalid-date' }, 'invalid toDate'],
    [{ fromDate: '2026-02-30', toDate: '2026-03-01' }, 'impossible calendar date'],
    [{ fromDate: '2026-01-21', toDate: '2026-01-20' }, 'toDate before fromDate'],
  ])('returns HTTP 400 for %s (%s)', async (body) => {
    req.body = body;

    await getProjectsCommittedHours(req, res);

    expect(Project.aggregate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
      }),
    );
  });

  test('returns HTTP 500 and logs the exception when aggregation fails', async () => {
    const error = new Error('Database unavailable');
    Project.aggregate.mockRejectedValue(error);

    await getProjectsCommittedHours(req, res);

    expect(logger.logException).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Error fetching project logged hours.');
  });
});
