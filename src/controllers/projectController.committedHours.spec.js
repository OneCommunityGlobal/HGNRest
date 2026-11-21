jest.mock('../models/timeentry', () => ({ aggregate: jest.fn() }));
jest.mock('../startup/logger', () => ({ logInfo: jest.fn(), logException: jest.fn() }));
jest.mock('../utilities/permissions', () => ({
  ...jest.requireActual('../utilities/permissions'),
  hasPermission: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const timeEntry = require('../models/timeentry');
const logger = require('../startup/logger');
const { hasPermission } = require('../utilities/permissions');
const projectRouter = require('../routes/projectRouter');

describe('project volunteer hours route', () => {
  const url = '/api/projects/committed-hours';
  const dates = { fromDate: '2026-01-10', toDate: '2026-01-10' };
  const requestor = { requestorId: 'test-user' };
  const lean = jest.fn();
  const Project = { find: jest.fn(() => ({ lean })) };
  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    req.body.requestor = requestor;
    next();
  });
  app.use('/api', projectRouter(Project));

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    lean.mockResolvedValue([
      { _id: 'project-1', projectName: 'Project Alpha' },
      { _id: 'project-2', projectName: 'Project Beta' },
    ]);
    timeEntry.aggregate.mockResolvedValue([{ _id: 'project-1', totalSeconds: 52000 }]);
  });

  test.each(['get', 'post'])('returns logged hours through %s', async (method) => {
    const pendingRequest = request(app)[method](url);
    const result = await (method === 'get'
      ? pendingRequest.query(dates)
      : pendingRequest.send(dates));

    expect(result.status).toBe(200);
    expect(result.body).toEqual([
      { projectId: 'project-1', projectName: 'Project Alpha', loggedHours: 14.4 },
      { projectId: 'project-2', projectName: 'Project Beta', loggedHours: 0 },
    ]);
    expect(Project.find).toHaveBeenCalledWith({ isArchived: { $ne: true } }, 'projectName');
    expect(timeEntry.aggregate).toHaveBeenCalledTimes(1);
    expect(timeEntry.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          projectId: { $ne: null },
          entryType: { $in: ['default', 'person', null] },
          dateOfWork: { $gte: dates.fromDate, $lte: dates.toDate },
        },
      },
      { $group: { _id: '$projectId', totalSeconds: { $sum: '$totalSeconds' } } },
    ]);
  });

  test.each([
    {},
    { fromDate: dates.fromDate },
    { toDate: dates.toDate },
    { fromDate: '2026-02-30', toDate: '2026-03-01' },
    { fromDate: '2026-01-11', toDate: dates.toDate },
    { fromDate: [dates.fromDate, dates.fromDate], toDate: dates.toDate },
  ])('rejects invalid dates %j before querying', async (query) => {
    const result = await request(app).get(url).query(query);

    expect(result.status).toBe(400);
    expect(result.body.error).toEqual(expect.any(String));
    expect(Project.find).not.toHaveBeenCalled();
    expect(timeEntry.aggregate).not.toHaveBeenCalled();
  });

  test('requires report permission', async () => {
    hasPermission.mockResolvedValue(false);

    const result = await request(app).get(url).query(dates);

    expect(result.status).toBe(403);
    expect(hasPermission).toHaveBeenCalledWith(requestor, 'getReports');
    expect(Project.find).not.toHaveBeenCalled();
    expect(timeEntry.aggregate).not.toHaveBeenCalled();
  });

  test('returns an empty list when there are no reportable projects', async () => {
    lean.mockResolvedValue([]);

    const result = await request(app).get(url).query(dates);

    expect(result.status).toBe(200);
    expect(result.body).toEqual([]);
  });

  test('logs aggregation errors and returns HTTP 500', async () => {
    const error = new Error('Database unavailable');
    timeEntry.aggregate.mockRejectedValue(error);

    const result = await request(app).get(url).query(dates);

    expect(result.status).toBe(500);
    expect(logger.logException).toHaveBeenCalledWith(error);
  });
});
