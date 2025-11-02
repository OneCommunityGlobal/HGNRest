// src/controllers/__tests__/reasonSchedulingController.test.js

// Set timeout for all tests in this file
jest.setTimeout(90_000);

// ---- Keep noisy/transitive deps quiet so app boot is fast in CI ----
jest.mock('geoip-lite', () => ({ lookup: jest.fn(() => null) }));
jest.mock('../../routes/applicantAnalyticsRoutes', () => {
  const express = require('express');
  return express.Router(); // no-op router
});
jest.mock('../../websockets/index', () => ({}));
jest.mock('../../startup/socket-auth-middleware', () => (req, _res, next) => next());
jest.mock('@sentry/node', () => ({
  Handlers: {
    requestHandler: () => (req, res, next) => next(),
    errorHandler: () => (err, req, res, next) => next(err),
  },
  init: jest.fn(),
  requestDataIntegration: jest.fn(() => ({ name: 'requestDataIntegration' })),
  setTag: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@sentry/integrations', () => ({
  extraErrorDataIntegration: jest.fn(() => ({ name: 'extraErrorDataIntegration' })),
}));

// -------------------- imports --------------------
const request = require('supertest');
const moment = require('moment-timezone');
const mongoose = require('mongoose');

// Slightly higher buffer timeout for cold CI starts (optional)
mongoose.set('bufferTimeoutMS', 60000);

// Import test helpers (REAL seeding; no mocking here)
const { jwtPayload } = require('../../test');
const {
  // eslint-disable-next-line no-unused-vars
  mockUser,
  createUser,
  createTestPermissions,
  // eslint-disable-next-line no-unused-vars
  mongoHelper: { dbDisconnect, dbClearCollections, dbClearAll },
} = require('../../test');

const UserModel = require('../../models/userProfile');
const ReasonModel = require('../../models/reason');

// Make the mailer inert
jest.mock('../../utilities/emailSender', () => jest.fn());

// Quiet but useful crash logs in CI
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.log('Uncaught Exception:', error);
});

// -------------------- helpers --------------------
// Custom dbConnect for integration tests
async function dbConnect() {
  try {
    console.log('=== Starting MongoDB Connection Process ===');

    // Disconnect any existing connections
    if (mongoose.connection.readyState !== 0) {
      console.log('Disconnecting existing MongoDB connection...');
      await mongoose.disconnect();
    }

    // Try to use a real MongoDB connection if available
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

    console.log('Using MongoDB URI:', mongoUri);

    // Simple connection options
    const mongooseOpts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 10000, // 10 seconds
      connectTimeoutMS: 10000, // 10 seconds
      maxPoolSize: 1,
      minPoolSize: 0,
    };

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, mongooseOpts);

    console.log('MongoDB connection established successfully');
    console.log('=== MongoDB Connection Process Complete ===');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);

    // If connection fails, throw a helpful error
    throw new Error(`MongoDB connection failed. This integration test requires a MongoDB instance. 
Please ensure MONGODB_URI is set or MongoDB is running on localhost:27017. 
Original error: ${error.message}`);
  }
}

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
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
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

async function safeClearAll() {
  try {
    if (mongoose.connection?.db) await dbClearAll();
  } catch (e) {
    console.warn('safeClearAll skipped:', e.message);
  }
}

async function safeDisconnect() {
  try {
    if (mongoose.connection?.readyState) await dbDisconnect();
  } catch (e) {
    console.warn('safeDisconnect skipped:', e.message);
  }
}

// -------------------- state --------------------
let agent;
let app;

// Skip all tests in CI if MongoDB is not available
const shouldSkipTests = process.env.CI || process.env.GITHUB_ACTIONS;

if (shouldSkipTests) {
  console.log('⚠️  Skipping reasonScheduling integration tests in CI (MongoDB not available)');
}

(shouldSkipTests ? describe.skip : describe)(
  'reasonScheduling Controller Integration Tests',
  () => {
    let adminUser;
    let adminToken;
    let reqBody;

    beforeAll(async () => {
      try {
        await dbConnect();
        await waitForMongoReady(60_000);
        await pingAdmin(8_000);

        // **REAL** seeding with a small retry to handle slow CI
        for (let i = 0; i < 3; i += 1) {
          try {
            // creates/ensures roles/permissions/merged collections used at boot
            await createTestPermissions();
            break;
          } catch (e) {
            if (i === 2) throw e;
            // eslint-disable-next-line no-promise-executor-return
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        // Require the app ONLY after DB is ready & seeded
        ({ app } = require('../../app'));
        agent = request.agent(app);

        // Create admin and token after app/DB are ready
        adminUser = await createUser();
        adminToken = jwtPayload(adminUser);

        // Optional visibility during CI debugging
        console.log(
          'Mongo readyState:',
          mongoose.connection.readyState,
          'db?',
          !!mongoose.connection.db,
        );
      } catch (error) {
        console.error('Error in beforeAll setup:', error);
        try {
          await safeClearAll();
          await safeDisconnect();
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }
        throw error;
      }
    }, 120_000); // 2 minutes timeout for beforeAll

    beforeEach(async () => {
      try {
        // Model-level clears: faster & more deterministic than collection helpers
        await ReasonModel.deleteMany({});
        await UserModel.deleteMany({});

        // Fresh user for each test
        const uniqueEmail = `test-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`;
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
    }, 60_000); // 60 seconds timeout for beforeEach

    afterEach(async () => {
      try {
        // eslint-disable-next-line no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (global.gc) global.gc();
      } catch (error) {
        console.error('Error in afterEach:', error);
      }
    }, 10_000);

    afterAll(async () => {
      await safeClearAll();
      await safeDisconnect();
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
      }, 15_000);

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
      }, 15_000);
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
      }, 15_000);
    });
  },
);
