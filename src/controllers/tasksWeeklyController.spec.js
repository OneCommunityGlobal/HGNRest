jest.mock('../models/task', () => ({
  aggregate: jest.fn(),
  countDocuments: jest.fn(),
}));

const Task = require('../models/task');
const { getTrends } = require('./tasksWeeklyController');

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
