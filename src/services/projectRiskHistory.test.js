// v1.0.0
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const Profile = require('../models/bmdashboard/projectRiskProfile');
const Observation = require('../models/bmdashboard/projectRiskObservation');
const Issue = require('../models/bmdashboard/Issues');
const router = require('../routes/bmdashboard/bmProjectRiskProfileRouter');
const { captureDailyRisk, recordObservation } = require('./projectRiskHistory');

let mongo;
let app;
let project;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  });
  await Observation.init();
  app = express();
  app.use(express.json());
  // Exercise the router's role check; production JWT verification is in startup/middleware.
  app.use((req, res, next) => {
    req.user = { role: req.header('test-role') };
    next();
  });
  app.use('/api', router);
});
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([Profile.deleteMany({}), Observation.deleteMany({}), Issue.deleteMany({})]);
  project = await Issue.create({
    projectName: 'Test project',
    equipmentIssues: 1,
    laborIssues: 1,
    materialIssues: 1,
  });
});
const input = () => ({
  projectId: String(project._id),
  startDate: '2026-01-01',
  endDate: '2026-04-11',
  initialCostEstimate: 100,
  currentCostIncurred: 120,
  status: 'active',
});

test('create/update stores one daily observation, GET returns stable IDs and never writes', async () => {
  const created = await request(app)
    .post('/api/projects/risk-profile')
    .set('test-role', 'Administrator')
    .send(input())
    .expect(201);
  await request(app)
    .patch(`/api/projects/risk-profile/${project._id}`)
    .set('test-role', 'Owner')
    .send({ currentCostIncurred: 130, history: [{ predictedCostOverrun: -99 }] })
    .expect(200);
  expect(await Observation.countDocuments()).toBe(1);
  expect((await Observation.findOne()).predictedCostOverrun).toBe(30);
  const before = await Observation.find().lean();
  const response = await request(app).get('/api/projects/risk-profile').expect(200);
  expect(response.body[0].projectId).toBe(String(project._id));
  expect(response.body[0]._id).toBe(created.body._id);
  expect(response.body[0].history).toHaveLength(1);
  expect(await Observation.find().lean()).toEqual(before);
});
test('daily recording preserves past data and updates same day without duplicate rows', async () => {
  await Profile.create(input());
  await captureDailyRisk(new Date('2026-03-01T01:00:00Z'));
  await captureDailyRisk(new Date('2026-03-01T02:00:00Z'));
  await captureDailyRisk(new Date('2026-03-02T01:00:00Z'));
  expect(await Observation.countDocuments()).toBe(2);
});
test('role and validation failures do not create profiles', async () => {
  await request(app)
    .post('/api/projects/risk-profile')
    .set('test-role', 'Volunteer')
    .send(input())
    .expect(403);
  await request(app)
    .post('/api/projects/risk-profile')
    .set('test-role', 'Administrator')
    .send({ ...input(), endDate: '2025-01-01' })
    .expect(400);
  await request(app)
    .post('/api/projects/risk-profile')
    .set('test-role', 'Administrator')
    .send({ ...input(), status: 'completed' })
    .expect(400);
  expect(await Profile.countDocuments()).toBe(0);
});

test('demo seeding is repeatable and leaves ordinary records untouched', async () => {
  const { seedProjectRisk } = require('../utilities/projectRiskSeeder');
  const ordinary = await Profile.create(input());
  const original = ordinary.toObject();
  await seedProjectRisk(new Date('2026-10-31T12:00:00Z'));
  await seedProjectRisk(new Date('2026-10-31T12:00:00Z'));
  expect(await Profile.countDocuments()).toBe(6);
  expect(await Observation.countDocuments()).toBe(5 * 181);
  expect(await Profile.findById(ordinary._id).lean()).toEqual(original);
  const response = await request(app).get('/api/projects/risk-profile').expect(200);
  const high = response.body.find((row) => row.projectName === '[Risk Demo] High risk');
  expect(high.predictedTimeDelay).toBeGreaterThan(115);
  expect(high.history).toHaveLength(181);
});

test('duplicate creates cannot produce multiple profiles for one project', async () => {
  const responses = await Promise.all(
    [0, 1].map(() =>
      request(app)
        .post('/api/projects/risk-profile')
        .set('test-role', 'Administrator')
        .send(input()),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(await Profile.countDocuments()).toBe(1);
});

test('nonexistent issue references are rejected before create and update', async () => {
  const issues = ['abcdefabcdefabcdefabcdef'];
  await request(app)
    .post('/api/projects/risk-profile')
    .set('test-role', 'Administrator')
    .send({ ...input(), issues })
    .expect(400);
  expect(await Profile.countDocuments()).toBe(0);
  await request(app)
    .post('/api/projects/risk-profile')
    .set('test-role', 'Administrator')
    .send(input())
    .expect(201);
  await request(app)
    .patch(`/api/projects/risk-profile/${project._id}`)
    .set('test-role', 'Administrator')
    .send({ issues })
    .expect(400);
  expect((await Profile.findOne()).issues).toHaveLength(0);
});

test('a delayed older capture cannot overwrite a newer daily observation', async () => {
  const profile = await Profile.create(input());
  let release;
  const spy = jest.spyOn(Issue, 'find').mockImplementationOnce(() => ({
    lean: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  }));
  const oldCapture = recordObservation(profile, new Date('2026-10-30T01:00:00Z'));
  await recordObservation(
    { ...profile.toObject(), currentCostIncurred: 130 },
    new Date('2026-10-30T02:00:00Z'),
  );
  release([project.toObject()]);
  await oldCapture;
  spy.mockRestore();
  expect((await Observation.findOne()).predictedCostOverrun).toBe(30);
});
