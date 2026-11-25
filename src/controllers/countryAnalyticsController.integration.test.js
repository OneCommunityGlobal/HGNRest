const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Application = require('../models/application');
const cache = require('../utilities/cache');
const countryAnalyticsRouter = require('../routes/countryAnalyticsRouter');

// Exercise the real public router, controller, services, date helpers, cache, and
// model against an isolated database. No shared database or account is used.
const app = express();
app.use('/api/analytics', countryAnalyticsRouter);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  return res.status(error.status || 500).json({ success: false, error: error.message });
});

const endpoint = '/api/analytics/country-applications';
const dates = {
  startDate: '2026-10-10T00:00:00.000Z',
  endDate: '2026-10-12T23:59:59.999Z',
};

const makeApplication = (overrides = {}) => ({
  country: 'USA',
  countryName: 'United States',
  region: 'Americas',
  role: 'Developer',
  timestamp: new Date('2026-10-11T12:00:00.000Z'),
  numberOfApplicants: 1,
  ...overrides,
});

describe('country analytics API with a disposable MongoDB database', () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'country_analytics_tests' });
  });

  beforeEach(async () => {
    cache.clearAll();
    await Application.deleteMany({});
  });

  afterAll(async () => {
    cache.clearAll();
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  test('sums applicant counts by country, preserves map fields, and sorts by total', async () => {
    await Application.insertMany([
      makeApplication({ numberOfApplicants: 2 }),
      makeApplication({ role: 'Designer', numberOfApplicants: 3 }),
      makeApplication({
        country: 'IND',
        countryName: 'India',
        region: 'Asia',
        numberOfApplicants: 4,
      }),
      makeApplication({
        country: 'FRA',
        timestamp: new Date('2026-10-01'),
        numberOfApplicants: 99,
      }),
      makeApplication({
        country: 'DEU',
        timestamp: new Date('2026-10-20'),
        numberOfApplicants: 99,
      }),
    ]);
    const response = await request(app).get(endpoint).query(dates).expect(200);
    expect(response.body.data.map((row) => [row.country, row.count])).toEqual([
      ['USA', 5],
      ['IND', 4],
    ]);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({ countryName: 'United States', region: 'Americas' }),
    );
    expect(response.body.data[0].roles.sort()).toEqual(['Designer', 'Developer']);
    expect(response.body.meta).toEqual({
      ...dates,
      type: 'custom',
      roles: [],
      totalCountries: 2,
      totalApplicants: 9,
    });
  });

  test('includes both requested date endpoints and excludes adjacent milliseconds', async () => {
    await Application.insertMany([
      makeApplication({ timestamp: new Date(dates.startDate), numberOfApplicants: 2 }),
      makeApplication({ timestamp: new Date(dates.endDate), numberOfApplicants: 3 }),
      makeApplication({
        timestamp: new Date(Date.parse(dates.startDate) - 1),
        numberOfApplicants: 50,
      }),
      makeApplication({
        timestamp: new Date(Date.parse(dates.endDate) + 1),
        numberOfApplicants: 50,
      }),
    ]);
    const response = await request(app).get(endpoint).query(dates).expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].count).toBe(5);
    expect(response.body.meta.totalApplicants).toBe(5);
  });

  test('applies trimmed, comma-separated role filters without cross-request cache leakage', async () => {
    await Application.insertMany([
      makeApplication({ numberOfApplicants: 2 }),
      makeApplication({ role: 'Designer', numberOfApplicants: 3 }),
      makeApplication({ role: 'Manager', numberOfApplicants: 8 }),
    ]);
    const developer = await request(app)
      .get(endpoint)
      .query({ ...dates, roles: ' Developer ' })
      .expect(200);
    const designer = await request(app)
      .get(endpoint)
      .query({ ...dates, roles: 'Designer' })
      .expect(200);
    const combined = await request(app)
      .get(endpoint)
      .query({ ...dates, roles: 'Developer, Designer' })
      .expect(200);
    const all = await request(app).get(endpoint).query(dates).expect(200);
    expect(developer.body.meta.totalApplicants).toBe(2);
    expect(designer.body.meta.totalApplicants).toBe(3);
    expect(combined.body.meta.totalApplicants).toBe(5);
    expect(combined.body.meta.roles).toEqual(['Developer', 'Designer']);
    expect(all.body.meta.totalApplicants).toBe(13);
  });

  test('calculates same-country previous-period counts and rounded percentage changes', async () => {
    await Application.insertMany([
      makeApplication({ numberOfApplicants: 4 }),
      makeApplication({ timestamp: new Date('2026-10-08T12:00:00Z'), numberOfApplicants: 3 }),
      makeApplication({
        role: 'Designer',
        timestamp: new Date('2026-10-08T12:00:00Z'),
        numberOfApplicants: 20,
      }),
    ]);
    const response = await request(app)
      .get(endpoint)
      .query({ ...dates, roles: 'Developer' })
      .expect(200);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        country: 'USA',
        count: 4,
        previousCount: 3,
        percentageChange: 33.33,
      }),
    );
  });

  test('reports 100 percent growth when a country has no previous applicants', async () => {
    await Application.create(makeApplication({ numberOfApplicants: 4 }));
    const response = await request(app).get(endpoint).query(dates).expect(200);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({ count: 4, previousCount: 0, percentageChange: 100 }),
    );
  });

  test('returns an empty success payload when the requested role has no applicants', async () => {
    await Application.create(makeApplication());
    const response = await request(app)
      .get(endpoint)
      .query({ ...dates, roles: 'NoSuchRole' })
      .expect(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.totalCountries).toBe(0);
    expect(response.body.meta.totalApplicants).toBe(0);
  });

  test('reuses an analytics cache entry and refreshes data after the cache is cleared', async () => {
    await Application.create(makeApplication({ numberOfApplicants: 2 }));
    const first = await request(app).get(endpoint).query(dates).expect(200);
    await Application.create(makeApplication({ numberOfApplicants: 7 }));
    const cached = await request(app).get(endpoint).query(dates).expect(200);
    expect(cached.body).toEqual(first.body);
    cache.analytics.flush();
    const refreshed = await request(app).get(endpoint).query(dates).expect(200);
    expect(refreshed.body.meta.totalApplicants).toBe(9);
  });

  test('keeps distinct custom date ranges in separate cache entries', async () => {
    await Application.insertMany([
      makeApplication({ numberOfApplicants: 2 }),
      makeApplication({ timestamp: new Date('2026-10-20T12:00:00Z'), numberOfApplicants: 7 }),
    ]);
    const first = await request(app).get(endpoint).query(dates).expect(200);
    const later = await request(app)
      .get(endpoint)
      .query({
        startDate: '2026-10-20T00:00:00.000Z',
        endDate: '2026-10-21T00:00:00.000Z',
      })
      .expect(200);
    expect(first.body.meta.totalApplicants).toBe(2);
    expect(later.body.meta.totalApplicants).toBe(7);
  });

  test('accepts the frontend ALL alias and omits comparison fields for all-time data', async () => {
    await Application.create(makeApplication({ timestamp: new Date(), numberOfApplicants: 6 }));
    const response = await request(app).get(endpoint).query({ timeFrame: 'ALL' }).expect(200);
    expect(response.body.meta.type).toBe('all');
    expect(response.body.meta.totalApplicants).toBe(6);
    expect(response.body.data[0]).not.toHaveProperty('previousCount');
    expect(response.body.data[0]).not.toHaveProperty('percentageChange');
  });

  test('uses a weekly range when no date filter is supplied', async () => {
    const response = await request(app).get(endpoint).expect(200);
    expect(response.body.meta.type).toBe('weekly');
    expect(response.body.data).toEqual([]);
  });

  test.each([
    { filter: 'invalid' },
    { startDate: 'not-a-date', endDate: dates.endDate },
    { startDate: dates.startDate },
    { endDate: dates.endDate },
  ])('returns 422 for invalid or incomplete date query %p', async (query) => {
    const response = await request(app).get(endpoint).query(query).expect(422);
    expect(response.body).toEqual({ success: false, error: expect.any(String) });
  });

  test('returns 400 when repeated role parameters form an array', async () => {
    const response = await request(app)
      .get(`${endpoint}?roles=Developer&roles=Designer`)
      .expect(400);
    expect(response.body.error).toBe('roles must be a comma-separated string.');
  });

  test('normalizes legacy string timestamps and falls back to createdAt if timestamp is absent', async () => {
    await Application.collection.insertMany([
      { ...makeApplication({ numberOfApplicants: 2 }), timestamp: '2026-10-11T12:00:00.000Z' },
      {
        country: 'IND',
        countryName: 'India',
        role: 'Developer',
        numberOfApplicants: 3,
        createdAt: new Date('2026-10-11T12:00:00.000Z'),
      },
    ]);
    const response = await request(app).get(endpoint).query(dates).expect(200);
    expect(response.body.meta.totalCountries).toBe(2);
    expect(response.body.meta.totalApplicants).toBe(5);
  });

  test('returns alphabetically sorted unique roles and refreshes the static cache on flush', async () => {
    await Application.insertMany([
      makeApplication({ role: 'Developer' }),
      makeApplication({ role: 'Developer' }),
      makeApplication({ role: 'Designer' }),
    ]);
    const first = await request(app).get('/api/analytics/roles').expect(200);
    expect(first.body).toEqual({ success: true, data: ['Designer', 'Developer'], count: 2 });
    await Application.create(makeApplication({ role: 'Administrator' }));
    const cached = await request(app).get('/api/analytics/roles').expect(200);
    expect(cached.body).toEqual(first.body);
    cache.static.flush();
    const refreshed = await request(app).get('/api/analytics/roles').expect(200);
    expect(refreshed.body).toEqual({
      success: true,
      data: ['Administrator', 'Designer', 'Developer'],
      count: 3,
    });
  });

  test('returns an empty role list for an empty database', async () => {
    const response = await request(app).get('/api/analytics/roles').expect(200);
    expect(response.body).toEqual({ success: true, data: [], count: 0 });
  });
});
