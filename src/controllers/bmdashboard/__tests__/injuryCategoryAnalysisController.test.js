jest.mock('../../../models/bmdashboard/buildingInjury', () => ({ aggregate: jest.fn() }));
const InjuryCategory = require('../../../models/bmdashboard/buildingInjury');
const { getCategoryAnalysis } = require('../injuryCategoryAnalysisController');

const response = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};
const query = { startDate: '2025-01-31', endDate: '2025-04-01' };

beforeEach(() => jest.clearAllMocks());

test.each([
  { startDate: '2025-02-30' },
  { endDate: '2024-01-01' },
  { interval: 'weekly' },
  { projectIds: 'invalid' },
  { startDate: '' },
  { startDate: '2000-01-01' },
])('rejects invalid analysis requests without querying the model: %p', async (override) => {
  const res = response();
  await getCategoryAnalysis({ query: { ...query, ...override } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(InjuryCategory.aggregate).not.toHaveBeenCalled();
});

test('applies all filters, includes the end day, and fills month labels across short months', async () => {
  InjuryCategory.aggregate.mockReturnValue({
    option: jest
      .fn()
      .mockResolvedValue([
        { year: 2025, month: 2, workerCategory: 'Volunteer', severity: 'Serious', count: 3 },
      ]),
  });
  const res = response();
  await getCategoryAnalysis(
    {
      query: {
        ...query,
        projectIds: '65419e61105441587e2dec99',
        severities: 'Serious',
        types: 'Fall',
      },
    },
    res,
  );
  const match = InjuryCategory.aggregate.mock.calls[0][0][0].$match;
  expect(String(match.projectId.$in[0])).toBe('65419e61105441587e2dec99');
  expect(match.severity).toEqual({ $in: ['Serious'] });
  expect(match.injuryType).toEqual({ $in: ['Fall'] });
  expect(match.date).toEqual({
    $gte: new Date('2025-01-31T00:00:00Z'),
    $lt: new Date('2025-04-02T00:00:00Z'),
  });
  const result = res.json.mock.calls[0][0];
  expect(result.days).toBe(61);
  expect(result.buckets.map((bucket) => bucket.label)).toEqual([
    'Jan 2025',
    'Feb 2025',
    'Mar 2025',
    'Apr 2025',
  ]);
  expect(result.buckets[0].records).toEqual([]);
  expect(result.buckets[1].records[0]).toEqual({
    workerCategory: 'Volunteer',
    severity: 'Serious',
    count: 3,
  });
});

test('places records in quarters across a year boundary', async () => {
  InjuryCategory.aggregate.mockReturnValue({
    option: jest.fn().mockResolvedValue([
      { year: 2024, month: 12, workerCategory: null, severity: null, count: 2 },
      { year: 2025, month: 1, workerCategory: 'Staff', severity: 'Low', count: 1 },
    ]),
  });
  const res = response();
  await getCategoryAnalysis(
    { query: { startDate: '2024-12-15', endDate: '2025-02-01', interval: 'quarterly' } },
    res,
  );
  const result = res.json.mock.calls[0][0];
  expect(result.buckets.map((bucket) => bucket.label)).toEqual(['Q4 2024', 'Q1 2025']);
  expect(result.buckets[0].records[0].workerCategory).toBe('Unknown');
});

test('returns an empty timeline and a safe message for model failures', async () => {
  InjuryCategory.aggregate.mockReturnValue({ option: jest.fn().mockResolvedValue([]) });
  const res = response();
  await getCategoryAnalysis({ query }, res);
  expect(res.json.mock.calls[0][0].buckets).toHaveLength(4);
  InjuryCategory.aggregate.mockReturnValue({
    option: jest.fn().mockRejectedValue(new Error('private details')),
  });
  await getCategoryAnalysis({ query }, res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'Unable to load injury category analysis.' });
});
