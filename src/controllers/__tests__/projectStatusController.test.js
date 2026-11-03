const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();

jest.mock('node-cache', () =>
  jest.fn().mockImplementation(() => ({
    get: mockCacheGet,
    set: mockCacheSet,
  })),
);

jest.mock('../../models/project', () => ({
  aggregate: jest.fn(),
}));

const Project = require('../../models/project');
const { getProjectStatusSummary } = require('../projectStatusController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe('projectStatusController.getProjectStatusSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockReturnValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the cached response and skips the aggregation when a cache hit occurs', async () => {
    const cached = { totalProjects: 9 };
    mockCacheGet.mockReturnValue(cached);
    const req = { query: {} };
    const res = makeRes();

    await getProjectStatusSummary(req, res);

    expect(mockCacheGet).toHaveBeenCalledWith('status:all:all');
    expect(res.json).toHaveBeenCalledWith(cached);
    expect(Project.aggregate).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('aggregates with an empty filter and caches under the "all:all" key when no dates are given', async () => {
    Project.aggregate.mockResolvedValue([{ total: 10, active: 6, completed: 3, inactive: 1 }]);
    const req = { query: {} };
    const res = makeRes();

    await getProjectStatusSummary(req, res);

    expect(Project.aggregate).toHaveBeenCalledWith([{ $match: {} }, expect.any(Object)]);

    const expectedResponse = {
      totalProjects: 10,
      activeProjects: 6,
      completedProjects: 3,
      delayedProjects: 1,
      percentages: {
        active: '60.0',
        completed: '30.0',
        delayed: '10.0',
      },
    };
    expect(res.json).toHaveBeenCalledWith(expectedResponse);
    expect(mockCacheSet).toHaveBeenCalledWith('status:all:all', expectedResponse);
  });

  it('filters by $gte only and keys the cache by startDate when only startDate is given', async () => {
    Project.aggregate.mockResolvedValue([{ total: 4, active: 4, completed: 0, inactive: 0 }]);
    const req = { query: { startDate: '2020-01-01' } };
    const res = makeRes();

    await getProjectStatusSummary(req, res);

    expect(Project.aggregate).toHaveBeenCalledWith([
      { $match: { createdDatetime: { $gte: new Date('2020-01-01') } } },
      expect.any(Object),
    ]);
    expect(mockCacheGet).toHaveBeenCalledWith('status:2020-01-01:all');
    expect(mockCacheSet).toHaveBeenCalledWith(
      'status:2020-01-01:all',
      expect.objectContaining({ totalProjects: 4 }),
    );
  });

  it('filters by $lte only and keys the cache by endDate when only endDate is given', async () => {
    Project.aggregate.mockResolvedValue([{ total: 2, active: 0, completed: 2, inactive: 0 }]);
    const req = { query: { endDate: '2020-01-31' } };
    const res = makeRes();

    await getProjectStatusSummary(req, res);

    expect(Project.aggregate).toHaveBeenCalledWith([
      { $match: { createdDatetime: { $lte: new Date('2020-01-31') } } },
      expect.any(Object),
    ]);
    expect(mockCacheGet).toHaveBeenCalledWith('status:all:2020-01-31');
  });

  it('filters by both $gte and $lte and keys the cache by both dates when both are given', async () => {
    Project.aggregate.mockResolvedValue([{ total: 1, active: 1, completed: 0, inactive: 0 }]);
    const req = { query: { startDate: '2020-01-01', endDate: '2020-01-31' } };
    const res = makeRes();

    await getProjectStatusSummary(req, res);

    expect(Project.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          createdDatetime: { $gte: new Date('2020-01-01'), $lte: new Date('2020-01-31') },
        },
      },
      expect.any(Object),
    ]);
    expect(mockCacheGet).toHaveBeenCalledWith('status:2020-01-01:2020-01-31');
  });

  it('returns zeroed counts and numeric 0 percentages when there are no matching projects', async () => {
    Project.aggregate.mockResolvedValue([]);
    const req = { query: {} };
    const res = makeRes();

    await getProjectStatusSummary(req, res);

    expect(res.json).toHaveBeenCalledWith({
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      delayedProjects: 0,
      percentages: { active: 0, completed: 0, delayed: 0 },
    });
  });

  it('returns 500 and does not cache when the aggregation fails', async () => {
    Project.aggregate.mockRejectedValue(new Error('DB down'));
    const req = { query: {} };
    const res = makeRes();

    await getProjectStatusSummary(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Failed to retrieve project status summary',
    });
    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});
