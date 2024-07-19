const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  // mockUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections },
  createTestPermissions,
  createUser,
} = require('../test');
// const UserProfile = require('../models/userProfile');

// let originalEnv;

console.log('******:', process.env.TIMEZONE_PREMIUM_KEY);

const agent = request.agent(app);

describe('timeZoneAPI routes', () => {
  let adminUser;
  let adminToken;
  let volunteerUser;
  let volunteerToken;
  const reqBody = {};

  beforeAll(async () => {
    await dbConnect();
    await createTestPermissions();
  });

  afterAll(async () => {
    await dbDisconnect();
  });

  describe('API routes', () => {
    beforeEach(async () => {
      await dbClearCollections('userProfiles');
      reqBody.body = {
        // This is the user we want to create
        ...mockReq.body,
      };
      adminUser = await createUser(); // This is the admin requestor user
      adminToken = jwtPayload(adminUser);
    });

    it("should return 404 if route doesn't exist", async () => {
      await agent
        .post('/api/timezonesss')
        .send(reqBody.body)
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('getTimeZone - API is missing', () => {
    beforeEach(async () => {
      await dbClearCollections('userProfiles');
      reqBody.body = {
        // This is the user we want to create
        ...mockReq.body,
      };
      volunteerUser = await createUser(); // This is the admin requestor user
      volunteerUser.role = 'Volunteer';
      volunteerToken = jwtPayload(volunteerUser);
    });

    afterEach(async () => {
      await dbClearCollections('userProfiles');
    });

    test('401 when `API` is missing', async () => {
      const location = 'someLocation';

      const response = await agent
        .get(`/api/timezone/${location}`)
        .set('Authorization', volunteerToken)
        .send(reqBody.body)
        .expect(401);

      expect(response.error.text).toBe('API Key Missing');
    });
  });

  // describe('getTimeZone - location is missing', () => {
  //   beforeAll(async () => {
  //     await dbClearCollections('userProfiles');
  //   });

  //   beforeEach(async () => {
  //     await dbClearCollections('userProfiles');
  //     reqBody.body = {
  //       // This is the user we want to create
  //       ...mockReq.body,
  //     };
  //     adminUser = await createUser(); // This is the admin requestor user
  //     adminToken = jwtPayload(adminUser);
  //   });

  //   test.only('400 when `location` is missing', async () => {

  //     await UserProfile.findByIdAndUpdate(adminUser._id, {
  //       $set: {
  //         role: 'admin',
  //       }
  //     });

  //     const response = await agent
  //       .get(`/api/timezone/ `) // Make sure this is the intended test
  //       .set('Authorization', adminToken)
  //       .send(reqBody.body)
  //       .expect(400);

  //     expect(response.error.text).toBe('Missing location');
  //   });
  // });
});
