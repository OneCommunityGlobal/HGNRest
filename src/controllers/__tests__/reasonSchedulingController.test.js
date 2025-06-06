const request = require('supertest');
const moment = require('moment-timezone');
const { jwtPayload } = require('../../test');
const { app } = require('../../app');
const {
  mockUser,
  createUser,
  createTestPermissions,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../../test');
const UserModel = require('../../models/userProfile');
const ReasonModel = require('../../models/reason');

// Set timeout for all tests in this file
jest.setTimeout(30000);

function mockDay(dayIdx, past = false) {
  const date = moment().tz('America/Los_Angeles').startOf('day');
  while (date.day() !== dayIdx) {
    date.add(past ? -1 : 1, 'days');
  }
  return date;
}

const agent = request.agent(app);

describe('reasonScheduling Controller Integration Tests', () => {
  let adminUser;
  let adminToken;
  let reqBody;

  beforeAll(async () => {
    try {
      await dbConnect();
      await createTestPermissions();
      adminUser = await createUser();
      adminToken = jwtPayload(adminUser);
    } catch (error) {
      console.error('Error in beforeAll setup:', error);
      throw error;
    }
  }, 30000);

  beforeEach(async () => {
    try {
      await dbClearCollections('reasons');
      await dbClearCollections('userprofiles');
      
      // Create a test user for each test with a unique email address
      const uniqueEmail = `test-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
      const testUser = await UserModel.create({
        firstName: 'Test',
        lastName: 'User',
        email: uniqueEmail,
        role: 'Volunteer',
        permissions: {
          isAcknowledged: true,
          frontPermissions: [],
          backPermissions: []
        },
        password: 'TestPassword123@',
        isActive: true,
        isSet: false,
        timeZone: 'America/Los_Angeles'
      });

      reqBody = {
        userId: testUser._id.toString(),
        requestor: { role: 'Administrator' },
        reasonData: {
          date: mockDay(0), // Sunday
          message: 'Test reason',
        },
        currentDate: moment.tz('America/Los_Angeles').startOf('day'),
      };
    } catch (error) {
      console.error('Error in beforeEach:', error);
      throw error;
    }
  }, 30000);

  afterEach(async () => {
    try {
      // Clean up any hanging connections or operations
      await new Promise(resolve => setTimeout(resolve, 100));
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
  }, 30000);

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
        })
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
        })
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
        })
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
        })
      );
    });

    test('Should return 200 when reason is successfully created', async () => {
      await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

      // Verify the reason was actually created in the database
      const savedReason = await ReasonModel.findOne({
        userId: reqBody.userId,
        date: moment.tz(reqBody.reasonData.date, 'America/Los_Angeles').startOf('day').toISOString(),
      });

      expect(savedReason).toBeTruthy();
      expect(savedReason.reason).toBe(reqBody.reasonData.message);
    }, 15000);

    test('Should return 403 when trying to create duplicate reason', async () => {
      // First create a reason
      await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

      // Try to create the same reason again
      const response = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(403);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'The reason must be unique to the date',
          errorCode: 3,
        })
      );
    }, 15000);
  });

  describe('GET /api/reason/:userId', () => {
    test('Should return 404 when user is not found', async () => {
      const response = await agent
        .get('/api/reason/60c72b2f5f1b2c001c8e4d67') // Non-existent user ID
        .set('Authorization', adminToken)
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'User not found',
        })
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
      // First create a reason
      await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

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
        .get('/api/reason/single/60c72b2f5f1b2c001c8e4d67') // Non-existent user ID
        .query({ queryDate: mockDay(0).toISOString() })
        .set('Authorization', adminToken)
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        })
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
      // First create a reason
      await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

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
        })
      );
    });

    test('Should return 404 when user is not found', async () => {
      reqBody.userId = '60c72b2f5f1b2c001c8e4d67'; // Non-existent user ID
      
      const response = await agent
        .patch(`/api/reason/${reqBody.userId}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        })
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
        })
      );
    });

    test('Should return 200 when reason is successfully updated', async () => {
      // First create a reason
      await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

      // Update the reason
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
        })
      );

      // Verify the reason was actually updated in the database
      const updatedReason = await ReasonModel.findOne({
        userId: reqBody.userId,
        date: moment.tz(reqBody.reasonData.date, 'America/Los_Angeles').startOf('day').toISOString(),
      });

      expect(updatedReason).toBeTruthy();
      expect(updatedReason.reason).toBe(updatedMessage);
    }, 15000);
  });


});
