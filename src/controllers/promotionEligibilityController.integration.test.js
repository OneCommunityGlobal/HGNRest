const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../config');
const middleware = require('../startup/middleware');
const UserProfile = require('../models/userProfile');
const Role = require('../models/role');
const FormResponse = require('../models/hgnFormResponse');
const TimeEntry = require('../models/timeentry');
const Task = require('../models/task');
const PromotionEligibility = require('../models/promotionEligibility');
const ReviewerGroup = require('../models/reviewerGroup');
const Team = require('../models/team');
const PromotionPrEntry = require('../models/promotionPrEntry');
const promotionRouter = require('../routes/promotionEligibilityRouter');
const formRouter = require('../routes/hgnFormResponseRouter');

// Real routes, authentication and models against disposable data only.
describe('questionnaire promotion eligibility integration', () => {
  let mongo;
  let app;
  let ids;
  let adminToken;
  let volunteerToken;
  const questionnaireModel = { find: (...args) => FormResponse.find(...args) };
  const token = (id, role) =>
    jwt.sign(
      { userid: id, role, expiryTimestamp: new Date(Date.now() + 60000).toISOString() },
      config.JWT_SECRET,
    );
  const read = (body = {}, auth = adminToken) =>
    request(app)
      .post('/api/promotion-eligibility')
      .set('Authorization', `Bearer ${auth}`)
      .send(body);
  const submit = () =>
    request(app)
      .post('/api/hgnform')
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({
        user_id: ids.newMember,
        userInfo: { name: 'New Member', email: 'new@example.test' },
        general: { hours: '21', preferences: ['Backend'] },
        frontend: {},
        backend: {},
        followUp: {},
      });
  const returnedIds = (response) => response.body.map((row) => row.reviewerId).sort();

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });
    app = express();
    middleware(app);
    app.use('/api/hgnform', formRouter);
    app.use(
      '/api',
      promotionRouter(
        UserProfile,
        TimeEntry,
        Task,
        PromotionEligibility,
        ReviewerGroup,
        Team,
        questionnaireModel,
        PromotionPrEntry,
      ),
    );
  });

  beforeEach(async () => {
    await Promise.all(
      [UserProfile, Role, FormResponse, TimeEntry, Task, PromotionEligibility, ReviewerGroup].map(
        (model) => model.deleteMany({}),
      ),
    );
    ids = Object.fromEntries(
      ['admin', 'newMember', 'respondent', 'inactive', 'owner', 'promoted'].map((key) => [
        key,
        new mongoose.Types.ObjectId(),
      ]),
    );
    await Role.create([
      { roleName: 'Administrator', permissions: ['getReports'] },
      { roleName: 'Volunteer', permissions: [] },
    ]);
    await UserProfile.collection.insertMany(
      Object.entries(ids).map(([key, _id]) => ({
        _id,
        firstName: key,
        lastName: 'Fixture',
        email: `${key}@example.test`,
        isActive: key !== 'inactive',
        role:
          { admin: 'Administrator', owner: 'Owner', promoted: 'Promoted Reviewer' }[key] ||
          'Volunteer',
        permissions: {},
        weeklycommittedHours: 21,
        createdDate: new Date('2026-10-01'),
      })),
    );
    await FormResponse.collection.insertMany(
      ['respondent', 'inactive', 'admin', 'owner', 'promoted'].map((key) => ({
        user_id: ids[key],
      })),
    );
    adminToken = token(ids.admin, 'Administrator');
    volunteerToken = token(ids.newMember, 'Volunteer');
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  it('adds a member after an actual questionnaire submission and retains the calculated row', async () => {
    const before = await read();
    expect(before.status).toBe(200);
    expect(returnedIds(before)).toEqual([String(ids.respondent)]);
    expect((await submit()).status).toBe(201);
    const after = await read();
    expect(after.status).toBe(200);
    expect(returnedIds(after)).toEqual([String(ids.respondent), String(ids.newMember)].sort());
    const row = after.body.find((entry) => entry.reviewerId === String(ids.newMember));
    expect(row).toMatchObject({ pledgedHours: 21, totalReviews: 0, remainingWeeks: 2 });
    expect(await PromotionEligibility.findOne({ reviewerId: ids.newMember })).not.toBeNull();
    expect(returnedIds(await read())).toEqual(returnedIds(after));
  });

  it('uses the injected questionnaire model once per eligibility read', async () => {
    const find = jest.spyOn(questionnaireModel, 'find');
    expect((await read()).status).toBe(200);
    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith({}, 'user_id');
  });

  it('does not duplicate a member when the questionnaire is submitted twice', async () => {
    expect((await submit()).status).toBe(201);
    expect((await submit()).status).toBe(201);
    const result = await read();
    expect(result.body.filter((row) => row.reviewerId === String(ids.newMember))).toHaveLength(1);
    expect(await PromotionEligibility.countDocuments({ reviewerId: ids.newMember })).toBe(1);
  });

  it('keeps inactive, Owner and Administrator respondents excluded, and promoted members in All', async () => {
    expect(returnedIds(await read())).toEqual([String(ids.respondent)]);
    const all = await read({ groupKey: 'all' });
    expect(all.status).toBe(200);
    expect(returnedIds(all)).toEqual([String(ids.respondent), String(ids.promoted)].sort());
  });

  it('handles missing, null and orphan respondent IDs and an empty questionnaire collection', async () => {
    await FormResponse.collection.insertMany([
      {},
      { user_id: null },
      { user_id: new mongoose.Types.ObjectId() },
    ]);
    expect(returnedIds(await read())).toEqual([String(ids.respondent)]);
    await FormResponse.deleteMany({});
    const result = await read();
    expect(result.status).toBe(200);
    expect(result.body).toEqual([]);
  });

  it('does not include a member after an invalid questionnaire submission', async () => {
    const submission = await request(app)
      .post('/api/hgnform')
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ user_id: ids.newMember });
    expect(submission.status).toBe(400);
    expect(returnedIds(await read())).toEqual([String(ids.respondent)]);
  });

  it('retains group validation and refuses unauthorized or forged report requests', async () => {
    expect((await read({ groupKey: 'missing-group' })).status).toBe(400);
    expect((await read({}, volunteerToken)).status).toBe(403);
    const find = jest.spyOn(questionnaireModel, 'find');
    expect(
      (await read({ requestor: { requestorId: ids.admin, role: 'Administrator' } }, volunteerToken))
        .status,
    ).toBe(403);
    expect(find).not.toHaveBeenCalled();
    expect((await request(app).post('/api/promotion-eligibility').send({})).status).toBe(401);
  });
});
