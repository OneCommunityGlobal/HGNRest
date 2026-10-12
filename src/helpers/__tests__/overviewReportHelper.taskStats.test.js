jest.mock('../../models/team', () => ({}));

jest.mock('../../models/userProfile', () => ({
  aggregate: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../models/timeentry', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../models/task', () => ({
  aggregate: jest.fn(),
  distinct: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../models/project', () => ({}));

const Task = require('../../models/task');
const TimeEntries = require('../../models/timeentry');
const UserProfile = require('../../models/userProfile');
const overviewReportHelperFactory = require('../overviewReportHelper');

describe('overviewReportHelper.getTasksStats', () => {
  const helper = overviewReportHelperFactory();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies date filter in non-comparison mode and maps assigned/completed counts', async () => {
    Task.countDocuments.mockResolvedValueOnce(7).mockResolvedValueOnce(8);

    const start = new Date('2026-08-01T00:00:00.000Z');
    const end = new Date('2026-08-07T23:59:59.999Z');
    const result = await helper.getTasksStats(start, end);

    expect(Task.countDocuments).toHaveBeenCalledTimes(2);
    const assignedFilter = Task.countDocuments.mock.calls[0][0];
    const completedFilter = Task.countDocuments.mock.calls[1][0];

    expect(assignedFilter.isActive).toBe(true);
    expect(assignedFilter.deleted).toEqual({ $ne: true });
    expect(assignedFilter.$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          createdDatetime: { $gte: start, $lte: end },
        }),
      ]),
    );
    expect(completedFilter.$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completedDatetime: { $ne: null, $gte: start, $lte: end },
        }),
        expect.objectContaining({
          'resources.completedTask': true,
          modifiedDatetime: { $gte: start, $lte: end },
        }),
      ]),
    );

    expect(result.active.current).toBe(7);
    expect(result.complete.current).toBe(8);
  });

  it('calculates comparison percentages using normalized completion statuses', async () => {
    // call order: currentAssigned, currentCompleted, comparisonAssigned, comparisonCompleted
    Task.countDocuments
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    const result = await helper.getTasksStats(
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-07T23:59:59.999Z'),
      new Date('2026-07-25T00:00:00.000Z'),
      new Date('2026-07-31T23:59:59.999Z'),
    );

    expect(Task.countDocuments).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      active: { current: 6, percentage: 2 },
      complete: { current: 5, percentage: 4 },
      raw: {
        current: [
          { _id: 'Assigned', count: 6 },
          { _id: 'Completed', count: 5 },
        ],
        comparison: [
          { _id: 'Assigned', count: 2 },
          { _id: 'Completed', count: 1 },
        ],
        counts: {
          current: {
            assigned: 6,
            completed: 5,
          },
          comparison: {
            assigned: 2,
            completed: 1,
          },
        },
      },
    });
  });

  it('keeps export rows array-shaped while returning date-range counts', async () => {
    Task.countDocuments.mockResolvedValueOnce(7).mockResolvedValueOnce(8);

    const result = await helper.getTasksStats(
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-07T23:59:59.999Z'),
    );

    expect(result.raw.current).toEqual([
      { _id: 'Assigned', count: 7 },
      { _id: 'Completed', count: 8 },
    ]);
    expect(result.raw.counts.current).toEqual({ assigned: 7, completed: 8 });
  });
});

describe('overviewReportHelper.getTaskAndProjectStats', () => {
  const helper = overviewReportHelperFactory();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses Date boundaries for dueDatetime filter so dashboard date changes affect task counts', async () => {
    TimeEntries.aggregate
      .mockResolvedValueOnce([{ totalHours: 10 }])
      .mockResolvedValueOnce([{ totalHours: 5 }]);
    UserProfile.aggregate.mockResolvedValueOnce([{ totalCommittedHours: 100 }]);
    Task.distinct.mockResolvedValueOnce(['u1', 'u2']);
    UserProfile.countDocuments.mockResolvedValueOnce(3);
    Task.countDocuments
      .mockResolvedValueOnce(6) // assigned tasks count
      .mockResolvedValueOnce(4); // completed tasks count

    await helper.getTaskAndProjectStats('2026-08-01', '2026-08-07');

    expect(Task.countDocuments).toHaveBeenCalledTimes(2);

    // Verify assigned tasks filter
    const assignedFilter = Task.countDocuments.mock.calls[0][0];
    expect(assignedFilter.isActive).toBe(true);
    expect(assignedFilter.deleted).toEqual({ $ne: true });
    expect(assignedFilter.$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          createdDatetime: expect.any(Object),
        }),
        expect.objectContaining({
          createdDatetime: { $exists: false },
          modifiedDatetime: expect.any(Object),
        }),
      ]),
    );

    // Verify completed tasks filter
    const completedFilter = Task.countDocuments.mock.calls[1][0];
    expect(completedFilter.isActive).toBe(true);
    expect(completedFilter.deleted).toEqual({ $ne: true });
    expect(completedFilter.$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completedDatetime: expect.objectContaining({ $ne: null }),
        }),
        expect.objectContaining({
          status: { $regex: /^(complete|completed|closed|done|finished)$/i },
        }),
        expect.objectContaining({
          'resources.completedTask': true,
        }),
      ]),
    );
  });
});

describe('overviewReportHelper.getBlueSquareStats', () => {
  const helper = overviewReportHelperFactory();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('converts stored date-only infringements before applying the category date range', async () => {
    UserProfile.aggregate
      .mockResolvedValueOnce([{ _id: 'missingHours', count: 1 }])
      .mockResolvedValueOnce([{ totalBlueSquares: 1 }]);

    const startDate = new Date('2026-09-01T07:00:00.000Z');
    const endDate = new Date('2026-10-01T06:59:59.999Z');
    const result = await helper.getBlueSquareStats(startDate, endDate);

    const categoryPipeline = UserProfile.aggregate.mock.calls[0][0];
    const convertStage = categoryPipeline.find(
      (stage) => stage.$addFields?.['infringements.parsedDate']?.$convert,
    );
    const rangeMatchIndex = categoryPipeline.findIndex(
      (stage) => stage.$match?.['infringements.parsedDate'],
    );

    expect(convertStage.$addFields['infringements.parsedDate'].$convert).toEqual({
      input: '$infringements.date',
      to: 'date',
      onError: null,
      onNull: null,
    });
    expect(rangeMatchIndex).toBeGreaterThan(categoryPipeline.indexOf(convertStage));
    expect(categoryPipeline[rangeMatchIndex].$match['infringements.parsedDate']).toEqual({
      $ne: null,
      $gte: startDate,
      $lte: endDate,
    });
    expect(result.missingHours.count).toBe(1);
    expect(result.totalBlueSquares.count).toBe(1);
  });
});
