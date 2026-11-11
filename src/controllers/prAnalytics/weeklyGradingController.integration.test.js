const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../../config');
const middleware = require('../../startup/middleware');
const WeeklyGrading = require('../../models/prAnalytics/weeklyGrading');
const Role = require('../../models/role');
const Insights = require('../../models/prAnalytics/prReviewsInsights');
const insightsRouter = require('../../routes/prAnalytics/prInsightsRouter');
const UserProfile = require('../../models/userProfile');
const weeklyGradingRouter = require('../../routes/prAnalytics/weeklyGradingRouter');

// Exercise the real router, JWT/permission checks and Mongoose persistence.
// This server creates only disposable data, never the configured app database.
describe('weekly grading soft removal integration', () => {
  let mongo;
  let app;
  let adminId;
  let volunteerId;
  let adminToken;
  let volunteerToken;
  const week = '2026-11-02';
  const query = { team: 'SoftRemovalTest', date: week, reviewer: 'Alice' };
  const token = (id, role) =>
    jwt.sign(
      {
        userid: id,
        role,
        expiryTimestamp: new Date(Date.now() + 60000).toISOString(),
      },
      config.JWT_SECRET,
    );
  const grading = (reviewer, date = week, teamCode = query.team) => ({
    reviewer,
    date: new Date(date),
    teamCode,
    prsNeeded: 5,
    prsReviewed: 1,
    gradedPrs: [{ prNumbers: '5660', grade: 'Exceptional' }],
    version: 2,
    versionHistory: [
      {
        version: 1,
        prsNeeded: 5,
        prsReviewed: 0,
        gradedPrs: [],
        updatedAt: new Date('2026-11-01'),
      },
    ],
  });
  const remove = (auth = adminToken, params = query) =>
    request(app).delete('/api/weekly-grading').query(params).set('Authorization', `Bearer ${auth}`);
  const get = (date = week, team = query.team) =>
    request(app)
      .get('/api/weekly-grading')
      .query({ team, date })
      .set('Authorization', `Bearer ${adminToken}`);

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });
    app = express();
    middleware(app);
    app.use('/api', weeklyGradingRouter(WeeklyGrading));
    app.use('/api', insightsRouter(Insights, UserProfile));
    await WeeklyGrading.init();
  });

  beforeEach(async () => {
    await Promise.all([
      WeeklyGrading.deleteMany({}),
      Role.deleteMany({}),
      UserProfile.deleteMany({}),
      Insights.deleteMany({}),
    ]);
    adminId = new mongoose.Types.ObjectId();
    volunteerId = new mongoose.Types.ObjectId();
    await Role.create([
      { roleName: 'Administrator', permissions: ['accessPRTeamDashboard'] },
      { roleName: 'Volunteer', permissions: [] },
    ]);
    await UserProfile.collection.insertMany([
      { _id: adminId, email: 'admin@example.test', role: 'Administrator', permissions: {} },
      { _id: volunteerId, email: 'volunteer@example.test', role: 'Volunteer', permissions: {} },
    ]);
    adminToken = token(adminId, 'Administrator');
    volunteerToken = token(volunteerId, 'Volunteer');
    // Include old records without isRemoved, duplicate daily snapshots and week edges.
    await WeeklyGrading.collection.insertMany([
      grading('Alice'),
      grading('Alice', '2026-11-08T23:59:59.999Z'),
      grading('Alice', '2026-11-01T23:59:59.999Z'),
      grading('Alice', '2026-11-09'),
      grading('Alice', week, 'OtherTestTeam'),
      grading('Bob'),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  it('hides all selected-week snapshots on repeated GETs while retaining grades/history and audit data', async () => {
    const before = await WeeklyGrading.find({}).lean();
    expect((await get()).body.map((row) => row.reviewer).sort()).toEqual(['Alice', 'Bob']);
    expect((await remove()).status).toBe(200);
    expect((await get()).body.map((row) => row.reviewer)).toEqual(['Bob']);
    expect((await get()).body.map((row) => row.reviewer)).toEqual(['Bob']);
    const after = await WeeklyGrading.find({}).lean();
    expect(after).toHaveLength(before.length);
    const removed = after.filter((row) => row.isRemoved);
    expect(removed).toHaveLength(2);
    removed.forEach((row) => {
      const original = before.find((item) => item._id.equals(row._id));
      expect(row.gradedPrs).toEqual(original.gradedPrs);
      expect(row.versionHistory).toEqual(original.versionHistory);
      expect(row.version).toBe(original.version);
      expect(row.prsReviewed).toBe(original.prsReviewed);
      expect(row.removedAt).toBeInstanceOf(Date);
      expect(row.removedBy.equals(adminId)).toBe(true);
    });
    // Historical/reporting queries remain unfiltered; removal is not a global model hook.
    const history = await WeeklyGrading.aggregate([
      { $match: { reviewer: 'Alice', teamCode: query.team } },
      { $group: { _id: '$reviewer', totalReviewed: { $sum: '$prsReviewed' } } },
    ]);
    expect(history[0].totalReviewed).toBe(4);
  });

  it('leaves previous/next weeks, other teams and other reviewers unchanged', async () => {
    await remove();
    expect((await get('2026-10-26')).body.map((row) => row.reviewer)).toEqual(['Alice']);
    expect((await get('2026-11-09')).body.map((row) => row.reviewer)).toEqual(['Alice']);
    expect((await get(week, 'OtherTestTeam')).body.map((row) => row.reviewer)).toEqual(['Alice']);
    expect(await WeeklyGrading.countDocuments({ reviewer: 'Bob', isRemoved: true })).toBe(0);
  });

  it('keeps legacy records with no removal flag visible and excludes removed records without a date filter', async () => {
    expect((await get()).body).toHaveLength(2);
    await remove();
    const response = await request(app)
      .get('/api/weekly-grading')
      .query({ team: query.team })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    // Alice still has visible records in other weeks.
    expect(response.body.map((row) => row.reviewer).sort()).toEqual(['Alice', 'Bob']);
    const alice = response.body.find((row) => row.reviewer === 'Alice');
    expect(alice.gradedPrs).toHaveLength(1);
  });

  it('returns 404 for a repeat removal and keeps the original audit timestamp', async () => {
    await remove();
    const before = await WeeklyGrading.findOne({ isRemoved: true }).lean();
    expect((await remove()).status).toBe(404);
    const after = await WeeklyGrading.findById(before._id).lean();
    expect(after.removedAt).toEqual(before.removedAt);
    expect(await WeeklyGrading.countDocuments({})).toBe(6);
  });

  it('does not resurrect a removed reviewer when a stale grading save arrives', async () => {
    await remove();
    const response = await request(app)
      .post('/api/weekly-grading/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ teamCode: query.team, date: week, gradings: [grading('Alice')] });
    expect(response.status).toBe(200);
    expect((await get()).body.map((row) => row.reviewer)).toEqual(['Bob']);
    expect(await WeeklyGrading.countDocuments({ isRemoved: true })).toBe(2);
  });

  it('rejects a Volunteer even when they supply an administrator requestor in the body', async () => {
    const response = await remove(volunteerToken).send({ requestor: { requestorId: adminId } });
    expect(response.status).toBe(403);
    expect(await WeeklyGrading.countDocuments({ isRemoved: true })).toBe(0);
    expect(await WeeklyGrading.countDocuments({})).toBe(6);
  });

  it('rejects missing and invalid authentication', async () => {
    expect((await request(app).delete('/api/weekly-grading').query(query)).status).toBe(401);
    expect((await remove('invalid-token')).status).toBe(401);
    expect(await WeeklyGrading.countDocuments({ isRemoved: true })).toBe(0);
  });

  it('rejects missing/invalid parameters without writing any records', async () => {
    expect((await remove(adminToken, { ...query, date: 'bad-date' })).status).toBe(400);
    expect((await remove(adminToken, { ...query, reviewer: ' ' })).status).toBe(400);
    expect((await remove(adminToken, { ...query, reviewer: { $ne: 'Bob' } })).status).toBe(400);
    expect((await remove(adminToken, { team: query.team, date: week })).status).toBe(400);
    expect(await WeeklyGrading.countDocuments({ isRemoved: true })).toBe(0);
  });

  it('preserves the existing analytics endpoint after removal', async () => {
    await Insights.create({
      teamCode: query.team,
      reviewDate: new Date(week),
      actionTaken: 'Approved',
      qualityLevel: 'Exceptional',
    });
    const analytics = () =>
      request(app)
        .get('/api/analytics/pr-review-insights')
        .query({ duration: 'allTime', teams: query.team })
        .set('Authorization', `Bearer ${adminToken}`);
    const before = await analytics();
    expect(before.status).toBe(200);
    expect(before.body.teams).toHaveLength(1);
    await remove();
    const after = await analytics();
    expect(after.status).toBe(200);
    expect(after.body).toEqual(before.body);
  });

  it('returns 404 for an unknown reviewer without changing existing data', async () => {
    expect((await remove(adminToken, { ...query, reviewer: 'Unknown' })).status).toBe(404);
    expect(await WeeklyGrading.countDocuments({ isRemoved: true })).toBe(0);
  });
});
