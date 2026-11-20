const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const { MongoMemoryServer } = require('mongodb-memory-server');
const Application = require('../../models/application');
const service = require('../../services/applicationsService');

const range = {
  start: new Date('2026-11-01T00:00:00.000Z'),
  end: new Date('2026-11-30T23:59:59.999Z'),
};
const previousRange = {
  start: new Date('2026-10-01T00:00:00.000Z'),
  end: new Date('2026-10-31T23:59:59.999Z'),
};
const entry = (overrides = {}) => ({
  country: 'IND',
  countryName: 'India',
  region: 'Asia',
  role: 'Developer',
  timestamp: new Date('2026-11-15T12:00:00.000Z'),
  numberOfApplicants: 1,
  jobId: 'job-1',
  applicationSource: 'job_listing',
  ...overrides,
});

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
beforeEach(async () => Application.deleteMany({}));
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('applications service with persisted MongoDB records', () => {
  test('sums applicant counts rather than document counts and sorts largest first', async () => {
    await Application.create([
      entry({ numberOfApplicants: 3 }),
      entry({ numberOfApplicants: 4 }),
      entry({ country: 'USA', numberOfApplicants: 2 }),
    ]);
    await expect(service.aggregateByCountry(range)).resolves.toEqual([
      { country: 'IND', count: 7 },
      { country: 'USA', count: 2 },
    ]);
  });

  test('includes both exact date boundaries and excludes records a millisecond outside them', async () => {
    await Application.create([
      entry({ timestamp: range.start, numberOfApplicants: 2 }),
      entry({ timestamp: range.end, numberOfApplicants: 3 }),
      entry({ timestamp: new Date(range.start.getTime() - 1), numberOfApplicants: 10 }),
      entry({ timestamp: new Date(range.end.getTime() + 1), numberOfApplicants: 20 }),
    ]);
    await expect(service.aggregateByCountry(range)).resolves.toEqual([
      { country: 'IND', count: 5 },
    ]);
  });

  test.each([undefined, []])('omitted or empty roles include all roles (%j)', async (roles) => {
    await Application.create([entry({ numberOfApplicants: 2 }), entry({ role: 'Designer' })]);
    await expect(service.aggregateByCountry(range, roles)).resolves.toEqual([
      { country: 'IND', count: 3 },
    ]);
  });

  test('role selection excludes other roles and supports multiple selections', async () => {
    await Application.create([
      entry({ numberOfApplicants: 2 }),
      entry({ role: 'Designer', numberOfApplicants: 4 }),
      entry({ role: 'Manager', numberOfApplicants: 8 }),
    ]);
    await expect(service.aggregateByCountry(range, ['Developer'])).resolves.toEqual([
      { country: 'IND', count: 2 },
    ]);
    await expect(service.aggregateByCountry(range, ['Developer', 'Designer'])).resolves.toEqual([
      { country: 'IND', count: 6 },
    ]);
  });

  test('normalizes legacy ISO timestamps and falls back to createdAt for null or missing timestamps', async () => {
    await Application.collection.insertMany([
      entry({ timestamp: '2026-11-10T12:00:00.000Z', numberOfApplicants: 2 }),
      entry({
        timestamp: null,
        createdAt: new Date('2026-11-11T00:00:00.000Z'),
        numberOfApplicants: 3,
      }),
      {
        country: 'IND',
        role: 'Developer',
        createdAt: '2026-11-12T00:00:00.000Z',
        numberOfApplicants: 4,
      },
      entry({
        timestamp: null,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        numberOfApplicants: 20,
      }),
    ]);
    await expect(service.aggregateByCountry(range)).resolves.toEqual([
      { country: 'IND', count: 9 },
    ]);
  });

  test('default country map includes unique roles but omits optional metadata', async () => {
    await Application.create([
      entry({ numberOfApplicants: 2 }),
      entry({ numberOfApplicants: 4 }),
      entry({ role: 'Designer', numberOfApplicants: 3 }),
    ]);
    const [country] = await service.getMapAnalytics(range);
    expect(country).toMatchObject({
      country: 'IND',
      countryName: 'India',
      region: 'Asia',
      count: 9,
    });
    expect(country.roles.sort()).toEqual(['Designer', 'Developer']);
    expect(country).not.toHaveProperty('jobIds');
    expect(country).not.toHaveProperty('applicationSources');
    expect(country).not.toHaveProperty('avgApplicantsPerEntry');
  });

  test('optional metadata deduplicates job IDs and sources and calculates the average', async () => {
    await Application.create([
      entry({ numberOfApplicants: 2 }),
      entry({ numberOfApplicants: 4 }),
      entry({ jobId: 'job-2', applicationSource: 'referral_link', numberOfApplicants: 3 }),
    ]);
    const [country] = await service.getMapAnalytics(range, [], { includeMetadata: true });
    expect(country.count).toBe(9);
    expect(country.avgApplicantsPerEntry).toBe(3);
    expect(country.jobIds.sort()).toEqual(['job-1', 'job-2']);
    expect(country.applicationSources.sort()).toEqual(['job_listing', 'referral_link']);
  });

  test('groups regions with unique countries and applies role filters before grouping', async () => {
    await Application.create([
      entry({ numberOfApplicants: 2 }),
      entry({ country: 'JPN', countryName: 'Japan', numberOfApplicants: 3 }),
      entry({ country: 'JPN', countryName: 'Japan', numberOfApplicants: 1 }),
      entry({
        country: 'USA',
        countryName: 'United States',
        region: 'Americas',
        numberOfApplicants: 1,
      }),
      entry({ role: 'Designer', numberOfApplicants: 20 }),
    ]);
    const regions = await service.getMapAnalytics(range, ['Developer'], { groupByRegion: true });
    expect(regions.map(({ region, count }) => ({ region, count }))).toEqual([
      { region: 'Asia', count: 6 },
      { region: 'Americas', count: 1 },
    ]);
    expect(regions[0].countries.sort()).toEqual(['IND', 'JPN']);
    expect(regions[0].countryNames.sort()).toEqual(['India', 'Japan']);
  });

  test('role statistics counts unique countries, sums applicants, and excludes other dates', async () => {
    await Application.create([
      entry({ numberOfApplicants: 2 }),
      entry({ numberOfApplicants: 4 }),
      entry({ country: 'USA', numberOfApplicants: 3 }),
      entry({ role: 'Designer', numberOfApplicants: 1 }),
      entry({ timestamp: new Date('2026-10-15T00:00:00.000Z'), numberOfApplicants: 20 }),
    ]);
    const roles = await service.getRoleStatistics(range);
    expect(roles[0]).toMatchObject({
      role: 'Developer',
      count: 9,
      countryCount: 2,
      avgApplicantsPerEntry: 3,
    });
    expect(roles[0].uniqueCountries.sort()).toEqual(['IND', 'USA']);
    expect(roles[1]).toMatchObject({ role: 'Designer', count: 1, countryCount: 1 });
  });

  test('comparison totals include countries that disappear from the current period', async () => {
    await Application.create([
      entry({ numberOfApplicants: 6 }),
      entry({ timestamp: new Date('2026-10-15T00:00:00.000Z'), numberOfApplicants: 3 }),
      entry({
        country: 'USA',
        timestamp: new Date('2026-10-15T00:00:00.000Z'),
        numberOfApplicants: 9,
      }),
    ]);
    const result = await service.getComparisonData(range, previousRange, ['Developer']);
    expect(result.totals).toEqual({ current: 6, previous: 12, percentageChange: -50 });
    expect(result.comparisonData.USA).toMatchObject({
      current: 0,
      previous: 9,
      percentageChange: -100,
    });
    expect(await Application.countDocuments()).toBe(3);
  });

  test('comparison with no current applicants reports a complete decline', async () => {
    await Application.create(entry({ timestamp: previousRange.start, numberOfApplicants: 7 }));
    await expect(service.getComparisonData(range, previousRange)).resolves.toMatchObject({
      totals: { current: 0, previous: 7, percentageChange: -100 },
    });
  });

  test('comparison filters both periods consistently', async () => {
    await Application.create([
      entry({ numberOfApplicants: 4 }),
      entry({ timestamp: previousRange.start, numberOfApplicants: 2 }),
      entry({ role: 'Designer', numberOfApplicants: 100 }),
      entry({ role: 'Designer', timestamp: previousRange.start, numberOfApplicants: 100 }),
    ]);
    await expect(
      service.getComparisonData(range, previousRange, ['Developer']),
    ).resolves.toMatchObject({
      totals: { current: 4, previous: 2, percentageChange: 100 },
    });
  });

  test('all analytics methods handle an empty collection', async () => {
    await expect(service.aggregateByCountry(range)).resolves.toEqual([]);
    await expect(service.getMapAnalytics(range)).resolves.toEqual([]);
    await expect(service.getMapAnalytics(range, [], { groupByRegion: true })).resolves.toEqual([]);
    await expect(service.getRoleStatistics(range)).resolves.toEqual([]);
    await expect(service.getComparisonData(range, previousRange)).resolves.toEqual({
      comparisonData: {},
      totals: { current: 0, previous: 0, percentageChange: 0 },
    });
  });
});
