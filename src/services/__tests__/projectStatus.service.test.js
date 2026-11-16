const dayjs = require('dayjs');

jest.mock('../../models/projectStatus', () => ({
  aggregate: jest.fn(),
}));

const ProjectStatus = require('../../models/projectStatus');
const { getProjectStatusSummary } = require('../projectStatus.service');

describe('projectStatus.service getProjectStatusSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates counts and percentages with no date filter', async () => {
    ProjectStatus.aggregate.mockResolvedValue([
      { _id: 'Active', count: 5 },
      { _id: 'Completed', count: 3 },
      { _id: 'Delayed', count: 2 },
    ]);

    const result = await getProjectStatusSummary({});

    expect(ProjectStatus.aggregate).toHaveBeenCalledWith([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    expect(result).toEqual({
      totalProjects: 10,
      activeProjects: 5,
      completedProjects: 3,
      delayedProjects: 2,
      percentages: { active: 50, completed: 30, delayed: 20 },
      window: { startDate: null, endDate: null },
    });
  });

  it('adds a $match stage with $gte only when startDate is given', async () => {
    ProjectStatus.aggregate.mockResolvedValue([]);

    await getProjectStatusSummary({ startDate: '2026-01-01' });

    const expectedGte = dayjs('2026-01-01').startOf('day').toDate();
    expect(ProjectStatus.aggregate).toHaveBeenCalledWith([
      { $match: { startDate: { $gte: expectedGte } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
  });

  it('adds a $match stage with $lte only when endDate is given', async () => {
    ProjectStatus.aggregate.mockResolvedValue([]);

    await getProjectStatusSummary({ endDate: '2026-01-31' });

    const expectedLte = dayjs('2026-01-31').endOf('day').toDate();
    expect(ProjectStatus.aggregate).toHaveBeenCalledWith([
      { $match: { startDate: { $lte: expectedLte } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
  });

  it('adds both $gte and $lte when startDate and endDate are given', async () => {
    ProjectStatus.aggregate.mockResolvedValue([]);

    await getProjectStatusSummary({ startDate: '2026-01-01', endDate: '2026-01-31' });

    const expectedGte = dayjs('2026-01-01').startOf('day').toDate();
    const expectedLte = dayjs('2026-01-31').endOf('day').toDate();
    expect(ProjectStatus.aggregate).toHaveBeenCalledWith([
      { $match: { startDate: { $gte: expectedGte, $lte: expectedLte } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
  });

  it('echoes the requested window back in the response', async () => {
    ProjectStatus.aggregate.mockResolvedValue([]);

    const result = await getProjectStatusSummary({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(result.window).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
  });

  it('ignores group rows whose _id is not a known status', async () => {
    ProjectStatus.aggregate.mockResolvedValue([
      { _id: 'Active', count: 1 },
      { _id: null, count: 4 },
      { _id: 'SomeOtherStatus', count: 9 },
    ]);

    const result = await getProjectStatusSummary({});

    expect(result.totalProjects).toBe(1);
    expect(result.activeProjects).toBe(1);
    expect(result.completedProjects).toBe(0);
    expect(result.delayedProjects).toBe(0);
  });

  it('returns zeroed counts and percentages when there are no projects', async () => {
    ProjectStatus.aggregate.mockResolvedValue([]);

    const result = await getProjectStatusSummary({});

    expect(result.totalProjects).toBe(0);
    expect(result.percentages).toEqual({ active: 0, completed: 0, delayed: 0 });
  });

  it('rounds percentages to one decimal place', async () => {
    ProjectStatus.aggregate.mockResolvedValue([
      { _id: 'Active', count: 1 },
      { _id: 'Completed', count: 1 },
      { _id: 'Delayed', count: 1 },
    ]);

    const result = await getProjectStatusSummary({});

    expect(result.percentages).toEqual({ active: 33.3, completed: 33.3, delayed: 33.3 });
  });

  it('wraps aggregation failures in a 500 error with a descriptive message', async () => {
    ProjectStatus.aggregate.mockRejectedValue(new Error('Mongo down'));

    await expect(getProjectStatusSummary({})).rejects.toMatchObject({
      message: 'Failed to aggregate project status summary: Mongo down',
      status: 500,
    });
  });
});
