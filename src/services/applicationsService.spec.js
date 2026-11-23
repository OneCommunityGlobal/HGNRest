jest.mock('../models/application', () => ({ aggregate: jest.fn() }));

const Application = require('../models/application');
const service = require('./applicationsService');

const currentRange = {
  start: new Date('2026-11-01T00:00:00.000Z'),
  end: new Date('2026-11-30T23:59:59.999Z'),
};
const previousRange = {
  start: new Date('2026-10-01T00:00:00.000Z'),
  end: new Date('2026-10-31T23:59:59.999Z'),
};
const compare = (current, previous, roles) => {
  Application.aggregate.mockResolvedValueOnce(current).mockResolvedValueOnce(previous);
  return service.getComparisonData(currentRange, previousRange, roles);
};

beforeEach(() => jest.resetAllMocks());

describe('applications analytics query contracts', () => {
  test.each([
    ['aggregateByCountry', undefined],
    ['aggregateByCountry', []],
    ['aggregateByCountry', ['Developer', 'Designer']],
    ['getMapAnalytics', undefined],
    ['getMapAnalytics', []],
    ['getMapAnalytics', ['Developer']],
  ])('%s applies the requested inclusive range and roles (%j)', async (method, roles) => {
    const records = [{ country: 'IND', count: 5 }];
    Application.aggregate.mockResolvedValue(records);
    await expect(service[method](currentRange, roles)).resolves.toBe(records);
    const pipeline = Application.aggregate.mock.calls[0][0];
    expect(pipeline.find((stage) => stage.$match).$match).toEqual({
      _ts: { $gte: currentRange.start, $lte: currentRange.end },
      ...(roles?.length ? { role: { $in: roles } } : {}),
    });
    expect(pipeline[pipeline.length - 1]).toEqual({ $sort: { count: -1 } });
  });

  test.each([false, true])('country map metadata is opt-in (%s)', async (includeMetadata) => {
    Application.aggregate.mockResolvedValue([]);
    await service.getMapAnalytics(currentRange, [], { includeMetadata });
    const pipeline = Application.aggregate.mock.calls[0][0];
    const group = pipeline.find((stage) => stage.$group).$group;
    const project = pipeline.find((stage) => stage.$project).$project;
    expect(group._id).toBe('$country');
    ['jobIds', 'applicationSources', 'avgApplicantsPerEntry'].forEach((field) => {
      expect(Object.prototype.hasOwnProperty.call(group, field)).toBe(includeMetadata);
      expect(Object.prototype.hasOwnProperty.call(project, field)).toBe(includeMetadata);
    });
  });

  test('region grouping does not add country-only metadata fields', async () => {
    Application.aggregate.mockResolvedValue([]);
    await service.getMapAnalytics(currentRange, [], { groupByRegion: true, includeMetadata: true });
    const pipeline = Application.aggregate.mock.calls[0][0];
    expect(pipeline.find((stage) => stage.$group).$group._id).toBe('$region');
    expect(pipeline.find((stage) => stage.$project).$project).not.toHaveProperty('jobIds');
  });

  test('role statistics returns the database result without changing the input range', async () => {
    const records = [{ role: 'Developer', count: 5, countryCount: 2 }];
    const original = { ...currentRange };
    Application.aggregate.mockResolvedValue(records);
    await expect(service.getRoleStatistics(currentRange)).resolves.toBe(records);
    expect(currentRange).toEqual(original);
  });

  test.each(['aggregateByCountry', 'getMapAnalytics', 'getRoleStatistics'])(
    '%s propagates aggregation failures',
    async (method) => {
      const error = new Error('Aggregation failed');
      Application.aggregate.mockRejectedValue(error);
      await expect(service[method](currentRange)).rejects.toBe(error);
    },
  );
});

describe('application comparison calculations', () => {
  test.each([
    [[], [], { current: 0, previous: 0, percentageChange: 0 }],
    [[{ country: 'IND', count: 6 }], [], { current: 6, previous: 0, percentageChange: 100 }],
    [[], [{ country: 'USA', count: 9 }], { current: 0, previous: 9, percentageChange: -100 }],
    [
      [{ country: 'IND', count: 6 }],
      [
        { country: 'IND', count: 3 },
        { country: 'USA', count: 9 },
      ],
      { current: 6, previous: 12, percentageChange: -50 },
    ],
    [
      [{ country: 'IND', count: 2 }],
      [{ country: 'IND', count: 3 }],
      { current: 2, previous: 3, percentageChange: -33.33 },
    ],
    [
      [{ country: 'IND', count: 0 }],
      [{ country: 'IND', count: 0 }],
      { current: 0, previous: 0, percentageChange: 0 },
    ],
  ])('calculates complete totals for %j versus %j', async (current, previous, totals) => {
    await expect(compare(current, previous)).resolves.toMatchObject({ totals });
  });

  test('retains current, new and previous-only countries with their individual percentages', async () => {
    const current = [
      { country: 'IND', countryName: 'India', count: 2 },
      { country: 'DEU', countryName: 'Germany', count: 4 },
    ];
    const previous = [
      { country: 'IND', count: 3 },
      { country: 'USA', count: 9 },
    ];
    const snapshot = JSON.parse(JSON.stringify({ current, previous }));
    const result = await compare(current, previous);
    expect(result.comparisonData).toEqual({
      IND: { current: 2, previous: 3, percentageChange: -33.33, countryName: 'India' },
      DEU: { current: 4, previous: 0, percentageChange: 100, countryName: 'Germany' },
      USA: { current: 0, previous: 9, percentageChange: -100, countryName: null },
    });
    expect({ current, previous }).toEqual(snapshot);
  });

  test('returns zero change for a new country with zero applicants', async () => {
    const result = await compare([{ country: 'IND', count: 0 }], []);
    expect(result.comparisonData.IND.percentageChange).toBe(0);
  });

  test.each([undefined, [], ['Developer']])(
    'applies the same role filter to both periods (%j)',
    async (roles) => {
      await compare([], [], roles);
      const matches = Application.aggregate.mock.calls.map(
        ([pipeline]) => pipeline.find((stage) => stage.$match).$match,
      );
      expect(matches).toEqual(
        [currentRange, previousRange].map((range) => ({
          _ts: { $gte: range.start, $lte: range.end },
          ...(roles?.length ? { role: { $in: roles } } : {}),
        })),
      );
    },
  );

  test.each([0, 1])('propagates a failed period query (%s)', async (failedQuery) => {
    const error = new Error('Comparison query failed');
    [0, 1].forEach((index) => {
      if (index === failedQuery) Application.aggregate.mockRejectedValueOnce(error);
      else Application.aggregate.mockResolvedValueOnce([]);
    });
    await expect(service.getComparisonData(currentRange, previousRange)).rejects.toBe(error);
  });
});
