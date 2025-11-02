// src/controllers/__tests__/reasonSchedulingController.test.js

jest.setTimeout(120_000);

// Stub noisy deps BEFORE app is required
jest.mock('geoip-lite', () => ({ lookup: jest.fn(() => null) }));
jest.mock('../../routes/applicantAnalyticsRoutes', () => {
  const express = require('express');
  return express.Router(); // no-op router
});
jest.mock('../../websockets/index', () => ({}));
jest.mock('../../startup/socket-auth-middleware', () => (req, _res, next) => next());

// Avoid real email side effects
jest.mock('../../utilities/emailSender', () => jest.fn());

const request = require('supertest');
const moment = require('moment-timezone');
const { jwtPayload } = require('../../test');
const {
  createUser,
  createTestPermissions,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../../test');
const UserModel = require('../../models/userProfile');
const ReasonModel = require('../../models/reason');

/** Return a moment() at start of day in PT for the next/prev given weekday.
 *  - past=false: strictly in the future (not today)
 *  - past=true: strictly in the past (not today)
 */
function mockDay(dayIdx, past = false) {
  const d = moment().tz('America/Los_Angeles').startOf('day');
  if (past) {
    d.subtract(1, 'day');
    while (d.day() !== dayIdx) d.subtract(1, 'day');
  } else {
    d.add(1, 'day');
    while (d.day() !== dayIdx) d.add(1, 'day');
  }
  return d;
}

describe('reasonScheduling Controller Integration Tests', () => {
  let app; // assigned after DB connect
  let server; // http.Server
  let agent; // supertest agent

  let adminUser;
  let adminToken;
  let reqBody;

  beforeAll(async () => {
    // 1) Connect DB and seed role/permission data BEFORE requiring the app
    await dbConnect();
    await createTestPermissions();

    // 2) Now it's safe to require the app (prevents model ops buffering)
    ({ app } = require('../../app'));

    // 3) Start ephemeral server so supertest has a real target
    server = app.listen(0);
    agent = request.agent(server);

    // 4) Create an admin and token we can reuse
    adminUser = await createUser();
    adminToken = jwtPayload(adminUser);
  });

  beforeEach(async () => {
    // Clear only what this suite owns; do not drop seeded role/perm collections
    await dbClearCollections('reasons');
    await dbClearCollections('userprofiles');

    const testUser = await UserModel.create({
      firstName: 'Test',
      lastName: 'User',
      email: `test-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`,
      role: 'Volunteer',
      permissions: { isAcknowledged: true, frontPermissions: [], backPermissions: [] },
      password: 'TestPassword123@',
      isActive: true,
      isSet: false,
      timeZone: 'America/Los_Angeles',
    });

    reqBody = {
      userId: testUser._id.toString(),
      requestor: { role: 'Administrator' },
      reasonData: {
        date: mockDay(0), // next Sunday (strictly future)
        message: 'Test reason',
      },
      currentDate: moment.tz('America/Los_Angeles').startOf('day'),
    };
  });

  afterAll(async () => {
    if (server && typeof server.close === 'function') {
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((res) => server.close(res));
    }
    await dbClearAll();
    await dbDisconnect();
  });

  describe('Basic Setup', () => {
    test('Should have valid test setup', () => {
      expect(adminUser).toBeDefined();
      expect(adminToken).toBeDefined();
      expect(reqBody).toBeDefined();
      expect(server && server.address()).toBeTruthy();
    });
  });

  describe('POST /api/reason/', () => {
    test('Should return 400 when date is not a Sunday', async () => {
      const body = { ...reqBody, reasonData: { ...reqBody.reasonData, date: mockDay(1) } }; // Monday

      const res = await agent
        .post('/api/reason/')
        .send(body)
        .set('Authorization', adminToken)
        .expect(400);

      expect(res.body).toEqual(
        expect.objectContaining({
          message: expect.stringContaining("You must choose the Sunday YOU'LL RETURN"),
          errorCode: 0,
        }),
      );
    });

    test('Should return 400 when date is in the past', async () => {
      const body = { ...reqBody, reasonData: { ...reqBody.reasonData, date: mockDay(0, true) } }; // past Sunday

      const res = await agent
        .post('/api/reason/')
        .send(body)
        .set('Authorization', adminToken)
        .expect(400);

      expect(res.body).toEqual(
        expect.objectContaining({
          message: 'You should select a date that is yet to come',
          errorCode: 7,
        }),
      );
    });

    test('Should return 400 when no reason message is provided', async () => {
      const body = { ...reqBody, reasonData: { ...reqBody.reasonData, message: null } };

      const res = await agent
        .post('/api/reason/')
        .send(body)
        .set('Authorization', adminToken)
        .expect(400);

      expect(res.body).toEqual(
        expect.objectContaining({
          message: 'You must provide a reason.',
          errorCode: 6,
        }),
      );
    });

    test('Should return 404 when user is not found', async () => {
      const body = { ...reqBody, userId: '60c72b2f5f1b2c001c8e4d67' }; // nonexistent-ish

      const res = await agent
        .post('/api/reason/')
        .send(body)
        .set('Authorization', adminToken)
        .expect(404);

      expect(res.body).toEqual(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        }),
      );
    });

    test('Should return 200 when reason is successfully created', async () => {
      await agent.post('/api/reason/').send(reqBody).set('Authorization', adminToken).expect(200);

      // Verify persisted doc
      const saved = await ReasonModel.findOne({
        userId: reqBody.userId,
        date: moment
          .tz(reqBody.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
      });

      expect(saved).toBeTruthy();
      expect(saved.reason).toBe(reqBody.reasonData.message);
    });

    test('Should return 403 when trying to create duplicate reason', async () => {
      await agent.post('/api/reason/').send(reqBody).set('Authorization', adminToken).expect(200);

      const res = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(403);

      expect(res.body).toEqual(
        expect.objectContaining({
          message: 'The reason must be unique to the date',
          errorCode: 3,
        }),
      );
    });
  });

  describe('GET /api/reason/:userId', () => {
    test('Should return 404 when user is not found', async () => {
      const res = await agent
        .get('/api/reason/60c72b2f5f1b2c001c8e4d67')
        .set('Authorization', adminToken)
        .expect(404);

      expect(res.body).toEqual(expect.objectContaining({ message: 'User not found' }));
    });

    test('Should return 200 with empty reasons array when no reasons exist', async () => {
      const res = await agent
        .get(`/api/reason/${reqBody.userId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(res.body).toHaveProperty('reasons');
      expect(Array.isArray(res.body.reasons)).toBe(true);
    });

    test('Should return 200 with reasons when they exist', async () => {
      await agent.post('/api/reason/').send(reqBody).set('Authorization', adminToken).expect(200);

      const res = await agent
        .get(`/api/reason/${reqBody.userId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(res.body).toHaveProperty('reasons');
      expect(Array.isArray(res.body.reasons)).toBe(true);
      expect(res.body.reasons.length).toBeGreaterThan(0);
      expect(res.body.reasons[0].reason).toBe(reqBody.reasonData.message);
    });
  });

  describe('GET /api/reason/single/:userId', () => {
    test('Should return 404 when user is not found', async () => {
      const res = await agent
        .get('/api/reason/single/60c72b2f5f1b2c001c8e4d67')
        .query({ queryDate: mockDay(0).toISOString() })
        .set('Authorization', adminToken)
        .expect(404);

      expect(res.body).toEqual(
        expect.objectContaining({ message: 'User not found', errorCode: 2 }),
      );
    });

    test('Should return 200 with default values when reason does not exist', async () => {
      const res = await agent
        .get(`/api/reason/single/${reqBody.userId}`)
        .query({ queryDate: mockDay(0).toISOString() })
        .set('Authorization', adminToken)
        .expect(200);

      expect(res.body).toEqual({
        reason: '',
        date: '',
        userId: '',
        isSet: false,
      });
    });

    test('Should return 200 with reason when it exists', async () => {
      await agent.post('/api/reason/').send(reqBody).set('Authorization', adminToken).expect(200);

      const res = await agent
        .get(`/api/reason/single/${reqBody.userId}`)
        .query({ queryDate: reqBody.reasonData.date.toISOString() })
        .set('Authorization', adminToken)
        .expect(200);

      expect(res.body).toHaveProperty('reason', reqBody.reasonData.message);
      expect(res.body).toHaveProperty('userId', reqBody.userId);
      expect(res.body).toHaveProperty('isSet', true);
    });
  });

  describe('PATCH /api/reason/:userId', () => {
    test('Should return 400 when no reason message is provided', async () => {
      const body = { ...reqBody, reasonData: { ...reqBody.reasonData, message: null } };

      const res = await agent
        .patch(`/api/reason/${reqBody.userId}`)
        .send(body)
        .set('Authorization', adminToken)
        .expect(400);

      expect(res.body).toEqual(
        expect.objectContaining({ message: 'You must provide a reason.', errorCode: 6 }),
      );
    });

    test('Should return 404 when user is not found', async () => {
      const body = { ...reqBody, userId: '60c72b2f5f1b2c001c8e4d67' };

      const res = await agent
        .patch(`/api/reason/${body.userId}`)
        .send(body)
        .set('Authorization', adminToken)
        .expect(404);

      expect(res.body).toEqual(
        expect.objectContaining({ message: 'User not found', errorCode: 2 }),
      );
    });

    test('Should return 404 when reason is not found', async () => {
      const res = await agent
        .patch(`/api/reason/${reqBody.userId}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(404);

      expect(res.body).toEqual(
        expect.objectContaining({ message: 'Reason not found', errorCode: 4 }),
      );
    });

    test('Should return 200 when reason is successfully updated', async () => {
      await agent.post('/api/reason/').send(reqBody).set('Authorization', adminToken).expect(200);

      const updatedMessage = 'Updated reason message';
      const body = { ...reqBody, reasonData: { ...reqBody.reasonData, message: updatedMessage } };

      const res = await agent
        .patch(`/api/reason/${reqBody.userId}`)
        .send(body)
        .set('Authorization', adminToken)
        .expect(200);

      expect(res.body).toEqual(expect.objectContaining({ message: 'Reason Updated!' }));

      // Verify persisted change
      const updated = await ReasonModel.findOne({
        userId: reqBody.userId,
        date: moment
          .tz(reqBody.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
      });
      expect(updated).toBeTruthy();
      expect(updated.reason).toBe(updatedMessage);
    });
  });
});
