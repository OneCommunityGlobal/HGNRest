// v1.1.0
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const Profile = require('../models/bmdashboard/projectRiskProfile');
const Observation = require('../models/bmdashboard/projectRiskObservation');
const LegacyIssue = require('../models/bmdashboard/Issues');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const BuildingIssue = require('../models/bmdashboard/buildingIssue');
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
  await Promise.all([
    Profile.deleteMany({}),
    Observation.deleteMany({}),
    LegacyIssue.deleteMany({}),
    BuildingProject.deleteMany({}),
    BuildingIssue.deleteMany({}),
  ]);
  project = await BuildingProject.create({ name: 'Test project', isActive: true });
  await BuildingIssue.create(
    ['open', 'open', 'open', 'closed'].map((status) => ({
      projectId: project._id,
      issueDate: new Date('2026-01-15'),
      createdBy: mongoose.Types.ObjectId(),
      issueTitle: ['Test issue'],
      issueText: ['Test issue description'],
      issueType: 'Equipment',
      status,
    })),
  );
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
  const issue = await BuildingIssue.findOne({ status: 'open' });
  const created = await request(app)
    .post('/api/projects/risk-profile')
    .set('test-role', 'Administrator')
    .send({ ...input(), issues: [String(issue._id)] })
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
  expect(response.body[0].totalOpenIssues).toBe(3);
  expect(response.body[0].history[0].totalOpenIssues).toBe(3);
  const filtered = await request(app)
    .get('/api/projects/risk-profile?startDate=2026-02-01&endDate=2026-02-28')
    .expect(200);
  expect(filtered.body[0].totalOpenIssues).toBe(0);
  expect(filtered.body[0].history[0].totalOpenIssues).toBe(3);
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
  const legacy = await LegacyIssue.create({
    projectName: 'Legacy demo project',
    equipmentIssues: 8,
    laborIssues: 0,
    materialIssues: 0,
  });
  const ordinary = await Profile.create({
    ...input(),
    projectId: legacy._id,
    issues: [legacy._id],
    demoDataset: 'project-risk-demo-v1',
  });
  const original = ordinary.toObject();
  const legacyHistory = await Observation.create({
    profileId: ordinary._id,
    date: new Date('2026-10-31'),
    recordedAt: new Date('2026-10-31T01:00:00Z'),
    totalOpenIssues: 8,
  });
  await seedProjectRisk(new Date('2026-10-31T12:00:00Z'));
  await seedProjectRisk(new Date('2026-10-31T12:00:00Z'));
  expect(await Profile.countDocuments()).toBe(6);
  await captureDailyRisk(new Date('2026-10-31T12:00:00Z'));
  expect(await Observation.countDocuments()).toBe(5 * 181 + 1);
  expect(await Observation.findById(legacyHistory._id).lean()).toEqual(legacyHistory.toObject());
  expect(await LegacyIssue.findById(legacy._id).lean()).toEqual(legacy.toObject());
  expect(await BuildingProject.countDocuments()).toBe(6);
  expect(await BuildingIssue.countDocuments()).toBe(23);
  expect(await Profile.findById(ordinary._id).lean()).toEqual(original);
  const response = await request(app).get('/api/projects/risk-profile').expect(200);
  expect(response.body).toHaveLength(6);
  expect(response.body.some((row) => row.projectId === String(legacy._id))).toBe(false);
  const high = response.body.find((row) => row.projectName === '[Risk Demo] High risk');
  expect(high.predictedTimeDelay).toBeGreaterThan(115);
  expect(high.history).toHaveLength(181);
  expect(high.totalOpenIssues).toBe(12);
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

test.each(['nonexistent', 'other project', 'legacy'])(
  '%s issue references are rejected before create and update',
  async (kind) => {
    let issueId = 'abcdefabcdefabcdefabcdef';
    if (kind === 'other project') {
      const foreign = await BuildingProject.create({ name: 'Other project' });
      const issue = await BuildingIssue.findOne();
      issue.projectId = foreign._id;
      await issue.save();
      issueId = String(issue._id);
    } else if (kind === 'legacy') {
      const issue = await LegacyIssue.create({
        projectName: 'Legacy issue',
        equipmentIssues: 0,
        laborIssues: 0,
        materialIssues: 0,
      });
      issueId = String(issue._id);
    }
    const issues = [issueId];
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
  },
);

test.each([{ $ne: null }, ['abcdefabcdefabcdefabcdef'], null, 123, 'not-an-id'])(
  'rejects non-scalar or invalid project IDs before querying (%j)',
  async (projectId) => {
    const lookup = jest.spyOn(Profile, 'exists');
    try {
      await request(app)
        .post('/api/projects/risk-profile')
        .set('test-role', 'Administrator')
        .send({ ...input(), projectId })
        .expect(400);
      expect(lookup).not.toHaveBeenCalled();
      expect(await Profile.countDocuments()).toBe(0);
      expect(await Observation.countDocuments()).toBe(0);
    } finally {
      lookup.mockRestore();
    }
  },
);

test('PATCH rejects invalid IDs and denied roles without changing saved data', async () => {
  const original = await Profile.create(input());
  await request(app)
    .patch('/api/projects/risk-profile/not-an-id')
    .set('test-role', 'Administrator')
    .send({ currentCostIncurred: 999 })
    .expect(400);
  await request(app)
    .patch(`/api/projects/risk-profile/${project._id}`)
    .set('test-role', 'Volunteer')
    .send({ currentCostIncurred: 999 })
    .expect(403);
  expect(await Profile.findById(original._id).lean()).toEqual(original.toObject());
});

test('a delayed older capture cannot overwrite a newer daily observation', async () => {
  const profile = await Profile.create(input());
  let release;
  let started;
  const pending = new Promise((resolve) => {
    started = resolve;
  });
  const spy = jest.spyOn(BuildingIssue, 'countDocuments').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
        started();
      }),
  );
  const oldCapture = recordObservation(profile, new Date('2026-10-30T01:00:00Z'));
  await pending;
  await recordObservation(
    { ...profile.toObject(), currentCostIncurred: 130 },
    new Date('2026-10-30T02:00:00Z'),
  );
  release(3);
  await oldCapture;
  spy.mockRestore();
  expect((await Observation.findOne()).predictedCostOverrun).toBe(30);
});
