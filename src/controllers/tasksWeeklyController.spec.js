jest.mock('../models/task', () => ({
  aggregate: jest.fn(),
  countDocuments: jest.fn(),
}));

const Task = require('../models/task');
const { getSummary, getTrends } = require('./tasksWeeklyController');

describe('tasksWeeklyController.getTrends', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses Sunday-start weeks and Pacific date boundaries', async () => {
    Task.aggregate.mockResolvedValue([]);
    const response = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getTrends(
      {
        query: {
          start: '2026-09-13',
          end: '2026-10-06',
          weeks: '4',
        },
      },
      response,
    );

    expect(response.json).toHaveBeenCalledWith([
      { week: '2026-09-13', assigned: 0, completed: 0 },
      { week: '2026-09-20', assigned: 0, completed: 0 },
      { week: '2026-09-27', assigned: 0, completed: 0 },
      { week: '2026-10-04', assigned: 0, completed: 0 },
    ]);

    const match = Task.aggregate.mock.calls[0][0][0].$match;
    expect(match.$or[0].createdDatetime).toEqual({
      $gte: new Date('2026-09-13T07:00:00.000Z'),
      $lte: new Date('2026-10-11T06:59:59.999Z'),
    });
  });

  it('uses the modified week as a resource-completion fallback without double-counting', async () => {
    Task.aggregate.mockResolvedValue([
      {
        createdDatetime: new Date('2026-08-01T00:00:00.000Z'),
        completedDatetime: new Date('2026-08-02T00:00:00.000Z'),
        modifiedDatetime: new Date('2026-09-20T12:00:00.000Z'),
        resources: [{ completedTask: true }],
      },
      {
        createdDatetime: new Date('2026-08-02T00:00:00.000Z'),
        completedDatetime: new Date('2026-09-14T12:00:00.000Z'),
        modifiedDatetime: new Date('2026-09-21T12:00:00.000Z'),
        resources: [{ completedTask: true }],
      },
    ]);
    const response = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getTrends(
      {
        query: {
          start: '2026-09-13',
          end: '2026-10-06',
          weeks: '4',
        },
      },
      response,
    );

    expect(response.json).toHaveBeenCalledWith([
      { week: '2026-09-13', assigned: 0, completed: 0 },
      { week: '2026-09-20', assigned: 0, completed: 2 },
      { week: '2026-09-27', assigned: 0, completed: 0 },
      { week: '2026-10-04', assigned: 0, completed: 0 },
    ]);
  });

  it('uses the same resource completion date in the summary as the weekly buckets', async () => {
    Task.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(2).mockResolvedValueOnce(8);
    Task.aggregate.mockResolvedValue([]);
    const response = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getSummary({ query: { start: '2026-09-20', end: '2026-09-20', weeks: '4' } }, response);

    expect(response.json).toHaveBeenCalledWith({
      totalTasks: 10,
      completedThisWeek: 2,
      openTasks: 8,
      averageCompletionTimeDays: 0,
    });
    const completedFilter = Task.countDocuments.mock.calls[1][0];
    expect(completedFilter.$or).toEqual(
      expect.arrayContaining([
        {
          'resources.completedTask': true,
          modifiedDatetime: {
            $gte: new Date('2026-09-20T07:00:00.000Z'),
            $lte: new Date('2026-09-27T06:59:59.999Z'),
          },
        },
        expect.objectContaining({
          'resources.completedTask': { $ne: true },
          completedDatetime: expect.any(Object),
        }),
      ]),
    );
  });

  it('rejects invalid date-only values', async () => {
    const response = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getTrends({ query: { start: 'not-a-date', end: '2026-10-06' } }, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: 'Invalid start or end date.' });
    expect(Task.aggregate).not.toHaveBeenCalled();
  });
});
