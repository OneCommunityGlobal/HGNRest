jest.mock('../../../models/bmdashboard/buildingTimeLogger', () => ({ aggregate: jest.fn() }));
jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));
jest.mock('../../../utilities/permissions', () => ({ hasPermission: jest.fn() }));

const BuildingTimeLog = require('../../../models/bmdashboard/buildingTimeLogger');
const logger = require('../../../startup/logger');
const { hasPermission } = require('../../../utilities/permissions');
const laborHoursDistributionController = require('../laborHoursDistributionController');

const makeReq = (query = {}) => ({
  query,
  body: { requestor: { requestorId: 'user-1' } },
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe('laborHoursDistributionController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
  });

  it('returns 403 when the requestor lacks permission', async () => {
    hasPermission.mockResolvedValue(false);
    const res = makeRes();
    await laborHoursDistributionController().getLaborHoursDistribution(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(BuildingTimeLog.aggregate).not.toHaveBeenCalled();
  });

  it.each([
    [{ start_date: '2024-01-01' }, 'start_date and end_date must be provided together'],
    [
      { start_date: '2024-02-30', end_date: '2024-03-01' },
      'Invalid start_date. Please use a valid YYYY-MM-DD date',
    ],
    [
      { start_date: '2024-03-02', end_date: '2024-03-01' },
      'Invalid date range: start_date must be before or equal to end_date',
    ],
    [{ project: 'invalid' }, 'Invalid project id'],
    [{ member: 'invalid' }, 'Invalid member id'],
  ])('validates filters %#', async (query, error) => {
    const res = makeRes();
    await laborHoursDistributionController().getLaborHoursDistribution(makeReq(query), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error });
  });

  it('returns real task totals and backend filter options', async () => {
    BuildingTimeLog.aggregate
      .mockResolvedValueOnce([
        { task: 'Framing', hours: 3.5 },
        { task: 'Electrical', hours: 1.5 },
      ])
      .mockResolvedValueOnce([{ id: 'project-1', name: 'Earthbag Village' }])
      .mockResolvedValueOnce([{ id: 'member-1', name: 'Alex Doe' }]);
    const res = makeRes();

    await laborHoursDistributionController().getLaborHoursDistribution(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      total_hours: 5,
      distribution: [
        { task: 'Framing', hours: 3.5, percentage: 70 },
        { task: 'Electrical', hours: 1.5, percentage: 30 },
      ],
      filters: {
        projects: [{ id: 'project-1', name: 'Earthbag Village' }],
        members: [{ id: 'member-1', name: 'Alex Doe' }],
      },
    });
  });

  it('applies date, project, and member filters to completed time logs', async () => {
    const project = '507f1f77bcf86cd799439011';
    const member = '507f191e810c19729de860ea';
    BuildingTimeLog.aggregate.mockResolvedValue([]);
    const res = makeRes();

    await laborHoursDistributionController().getLaborHoursDistribution(
      makeReq({
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        project,
        member,
      }),
      res,
    );

    const match = BuildingTimeLog.aggregate.mock.calls[0][0][0].$match;
    expect(match.status).toBe('completed');
    expect(String(match.project)).toBe(project);
    expect(String(match.member)).toBe(member);
    expect(match.createdAt.$gte.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(match.createdAt.$lte.toISOString()).toBe('2024-01-31T23:59:59.999Z');
  });

  it('returns 500 and logs aggregation errors', async () => {
    const error = new Error('database unavailable');
    BuildingTimeLog.aggregate.mockRejectedValue(error);
    const res = makeRes();
    await laborHoursDistributionController().getLaborHoursDistribution(makeReq(), res);
    expect(logger.logException).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
