// Set timeout for all tests in this file
jest.setTimeout(90_000);

// --- CI hardening: make createTestPermissions a no-op in THIS FILE ONLY ---
// (Must be placed BEFORE requiring '../../test')
jest.doMock('../../test', () => {
  const real = jest.requireActual('../../test');
  return {
    ...real,
    // Prevent rolesMergedPermissions.insertOne() in CI
    createTestPermissions: jest.fn(async () => {}),
  };
});

// Stub transitive deps so app boot is fast & quiet
jest.mock('geoip-lite', () => ({ lookup: jest.fn(() => null) }));
jest.mock('../../routes/applicantAnalyticsRoutes', () => {
  const express = require('express');
  return express.Router(); // no-op router
});
jest.mock('../../websockets/index', () => ({}));
jest.mock('../../startup/socket-auth-middleware', () => (req, _res, next) => next());

// -------------------- imports --------------------
const request = require('supertest');
const moment = require('moment-timezone');
const mongoose = require('mongoose');

// Slightly higher buffer timeout for cold CI starts (optional)
mongoose.set('bufferTimeoutMS', 60000);

// Now import from ../../test (after the doMock above)
const { jwtPayload } = require('../../test');
const {
  // eslint-disable-next-line no-unused-vars
  mockUser,
  createUser,
  createTestPermissions, // <-- this is now the mocked no-op
  // eslint-disable-next-line no-unused-vars
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../../test');

const UserModel = require('../../models/userProfile');
const ReasonModel = require('../../models/reason');

// Make the mailer inert
jest.mock('../../utilities/emailSender', () => jest.fn());

// Unhandled handlers (quiet logs are okay; they help in CI)
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.log('Uncaught Exception:', error);
});

// -------------------- helpers --------------------
async function waitForMongoReady(timeoutMs = 60000) {
  const start = Date.now();
  while (mongoose.connection.readyState !== 1) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Mongo did not connect in time');
    }
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

// Optional: verify DB is writable (avoids “connected but not writable yet”)
async function pingAdmin(timeoutMs = 10000) {
  const start = Date.now();
  // Some CI envs take a beat to become writable; loop a couple times.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // admin().ping() is cheap and verifies a healthy, writable connection
      // Note: when using in-memory mongo, this still resolves quickly
      // and exercises the same code path.
      if (mongoose.connection.db?.admin) {
        // eslint-disable-next-line no-await-in-loop
        await mongoose.connection.db.admin().ping();
        return;
      }
    } catch (_) {
      // swallow and retry
    }
    if (Date.now() - start > timeoutMs) break;
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 200));
  }
  // If ping didn’t work, we still proceed; waitForMongoReady already passed.
}

function mockDay(dayIdx, past = false) {
  const date = moment().tz('America/Los_Angeles').startOf('day');

  if (past) {
    if (date.day() === dayIdx) {
      date.subtract(7, 'days');
    } else {
      while (date.day() !== dayIdx) {
        date.subtract(1, 'days');
      }
    }
  } else {
    while (date.day() !== dayIdx) {
      date.add(1, 'days');
    }
  }
  return date;
}

// -------------------- state --------------------
let agent;
let app;

describe('reasonScheduling Controller Integration Tests', () => {
  let adminUser;
  let adminToken;
  let reqBody;

  beforeAll(async () => {
    try {
      await dbConnect();
      await waitForMongoReady(60000);
      await pingAdmin(8000); // optional extra safety

      // This is now a no-op (mocked above) so it cannot hang in CI.
      await createTestPermissions();

      // Require the app ONLY after DB is ready
      ({ app } = require('../../app'));
      agent = request.agent(app);

      // Create admin and token after app/DB are ready
      adminUser = await createUser();
      adminToken = jwtPayload(adminUser);
    } catch (error) {
      console.error('Error in beforeAll setup:', error);
      try {
        await dbClearAll();
        await dbDisconnect();
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      await waitForMongoReady(60000);
      await pingAdmin(5000);

      // Replace the retrying dbClearCollections logic with model-level deletes:
      await ReasonModel.deleteMany({});
      await UserModel.deleteMany({});

      const uniqueEmail = `test-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
      const testUser = await UserModel.create({
        firstName: 'Test',
        lastName: 'User',
        email: uniqueEmail,
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
        reasonData: { date: mockDay(0), message: 'Test reason' },
        currentDate: moment.tz('America/Los_Angeles').startOf('day'),
      };
    } catch (error) {
      console.error('Error in beforeEach:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      // small pause for any async cleanups
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (global.gc) global.gc();
    } catch (error) {
      console.error('Error in afterEach:', error);
    }
  }, 10000);

  afterAll(async () => {
    try {
      await dbClearAll();
      await dbDisconnect();
    } catch (error) {
      console.error('Error in afterAll:', error);
    }
  });

  // --------------- TESTS ---------------
  describe('Basic Setup', () => {
    test('Should have valid test setup', () => {
      expect(adminUser).toBeDefined();
      expect(adminToken).toBeDefined();
      expect(reqBody).toBeDefined();
    });
  });

  describe('POST /api/reason/', () => {
    test('Should return 400 when date is not a Sunday', async () => {
      reqBody.reasonData.date = mockDay(1); // Monday
      const response = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: expect.stringContaining("You must choose the Sunday YOU'LL RETURN"),
          errorCode: 0,
        }),
      );
    });

    test('Should return 400 when date is in the past', async () => {
      reqBody.reasonData.date = mockDay(0, true); // Past Sunday
      const response = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'You should select a date that is yet to come',
          errorCode: 7,
        }),
      );
    });

    test('Should return 400 when no reason message is provided', async () => {
      reqBody.reasonData.message = null;
      const response = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'You must provide a reason.',
          errorCode: 6,
        }),
      );
    });

    test('Should return 404 when user is not found', async () => {
      reqBody.userId = '60c72b2f5f1b2c001c8e4d67'; // Non-existent user ID
      const response = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        }),
      );
    });

    test('Should return 200 when reason is successfully created', async () => {
      await agent.post('/api/reason/').send(reqBody).set('Authorization', adminToken).expect(200);

      const savedReason = await ReasonModel.findOne({
        userId: reqBody.userId,
        date: moment
          .tz(reqBody.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
      });

      expect(savedReason).toBeTruthy();
      expect(savedReason.reason).toBe(reqBody.reasonData.message);
    }, 15000);

    test('Should return 403 when trying to create duplicate reason', async () => {
      await agent.post('/api/reason/').send(reqBody).set('Authorization', adminToken).expect(200);
      const response = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(403);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'The reason must be unique to the date',
          errorCode: 3,
        }),
      );
    }, 15000);
  });

  describe('GET /api/reason/:userId', () => {
    test('Should return 404 when user is not found', async () => {
      const response = await agent
        .get('/api/reason/60c72b2f5f1b2c001c8e4d67')
        .set('Authorization', adminToken)
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'User not found',
        }),
      );
    });

    test('Should return 200 with empty reasons array when no reasons exist', async () => {
      const response = await agent
        .get(`/api/reason/${reqBody.userId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('reasons');
    });

    test('Should return 200 with reasons when they exist', async () => {
      await agent.post('/api/reason/').send(reqBody).set('Authorization', adminToken).expect(200);

      const response = await agent
        .get(`/api/reason/${reqBody.userId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('reasons');
      expect(Array.isArray(response.body.reasons)).toBe(true);
      expect(response.body.reasons.length).toBeGreaterThan(0);
      expect(response.body.reasons[0].reason).toBe(reqBody.reasonData.message);
    });
  });

  describe('GET /api/reason/single/:userId', () => {
    test('Should return 404 when user is not found', async () => {
      const response = await agent
        .get('/api/reason/single/60c72b2f5f1b2c001c8e4d67')
        .query({ queryDate: mockDay(0).toISOString() })
        .set('Authorization', adminToken)
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        }),
      );
    });

    test('Should return 200 with default values when reason does not exist', async () => {
      const response = await agent
        .get(`/api/reason/single/${reqBody.userId}`)
        .query({ queryDate: mockDay(0).toISOString() })
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toEqual({
        reason: '',
        date: '',
        userId: '',
        isSet: false,
      });
    });

    test('Should return 200 with reason when it exists', async () => {
      await agent.post('/api/reason/').send(reqBody).set('Authorization', adminToken).expect(200);

      const response = await agent
        .get(`/api/reason/single/${reqBody.userId}`)
        .query({ queryDate: reqBody.reasonData.date.toISOString() })
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toHaveProperty('reason', reqBody.reasonData.message);
      expect(response.body).toHaveProperty('userId', reqBody.userId);
      expect(response.body).toHaveProperty('isSet', true);
    });
  });

  describe('PATCH /api/reason/:userId', () => {
    test('Should return 400 when no reason message is provided', async () => {
      reqBody.reasonData.message = null;

      const response = await agent
        .patch(`/api/reason/${reqBody.userId}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'You must provide a reason.',
          errorCode: 6,
        }),
      );
    });

    test('Should return 404 when user is not found', async () => {
      reqBody.userId = '60c72b2f5f1b2c001c8e4d67';

      const response = await agent
        .patch(`/api/reason/${reqBody.userId}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        }),
      );
    });

    test('Should return 404 when reason is not found', async () => {
      const response = await agent
        .patch(`/api/reason/${reqBody.userId}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'Reason not found',
          errorCode: 4,
        }),
      );
    });

    test('Should return 200 when reason is successfully updated', async () => {
      await agent.post('/api/reason/').send(reqBody).set('Authorization', adminToken).expect(200);

      const updatedMessage = 'Updated reason message';
      reqBody.reasonData.message = updatedMessage;

      const response = await agent
        .patch(`/api/reason/${reqBody.userId}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'Reason Updated!',
        }),
      );

      const updatedReason = await ReasonModel.findOne({
        userId: reqBody.userId,
        date: moment
          .tz(reqBody.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
      });

      expect(updatedReason).toBeTruthy();
      expect(updatedReason.reason).toBe(updatedMessage);
    }, 15000);
  });
});
