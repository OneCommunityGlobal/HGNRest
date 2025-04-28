const request = require('supertest');
const { jwtPayload } = require('../test');
const cache = require('../utilities/nodeCache')();
const { app } = require('../app');
const {
  mockReq,
  mockUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections },
  createTestPermissions,
  createUser,
} = require('../test');

const agent = request.agent(app);

describe('userProfile routes', () => {
  let user;
  let token;
  const reqBody = {
    // This is the user we want to create
    body: {
      ...mockReq.body,
      ...mockUser(),
    },
  };

  beforeAll(async () => {
    await dbConnect();
    await createTestPermissions();
    user = await createUser(); // This is the requestor user
    token = jwtPayload(user);
  });

  beforeEach(async () => {
    await dbClearCollections('userProfiles');
    cache.setCache('allusers', '[]');
  });

  afterAll(async () => {
    await dbClearCollections('rolesMergedPermissions', 'rolePermissionPresets');
    await dbDisconnect();
  });

  describe('API routes', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/userProfile').send(reqBody.body).expect(401);
      await agent.get('/api/userProfile').send(reqBody.body).expect(401);
    });

    it("should return 404 if route doesn't exists", async () => {
      await agent
        .post('/api/userProfiles')
        .send(reqBody.body)
        .set('Authorization', token)
        .expect(404);

      await agent
        .get('/api/userProfiles')
        .send(reqBody.body)
        .set('Authorization', token)
        .expect(404);
    });
  });

  describe('postUserProfile', () => {
    test('Should create a userProfile on success', async () => {
      // adding a user to the database
      let response = await agent
        .post('/api/userProfile')
        .send(reqBody.body)
        .set('Authorization', token)
        .expect(200);

      expect(response.body).toBeTruthy();

      // user has been saved, if it exists in the database, we should not be able to add another user.
      response = await agent
        .post('/api/userProfile')
        .send(reqBody.body)
        .set('Authorization', token)
        .expect(400);

      expect(response.body.error).toEqual(
        'That email address is already in use. Please choose another email address.',
      );
    });
  });

  // describe('getUserProfiles', () => {
  //   test('Should return user profiles on success', async () => {
  //     // adding a user to the database
  //     let response = await agent
  //       .post('/api/userProfile')
  //       .send(reqBody.body)
  //       .set('Authorization', token)
  //       .expect(200);
  //
  //     expect(response.body).toBeTruthy();
  //
  //     // user has been saved, we should be able to get it with the projected properties
  //     response = await agent
  //       .get('/api/userProfile')
  //       .send(reqBody.body)
  //       .set('Authorization', token)
  //       .expect(200);
  //
  //     const { email, firstName, lastName, createdDate, permissions, role, weeklycommittedHours, jobTitle, startDate, timeZone } =
  //       reqBody.body;
  //
  //     expect(response.body).toEqual([
  //       {
  //         _id: expect.anything(),
  //         createdDate,
  //         email,
  //         firstName,
  //         isActive: true,
  //         lastName,
  //         permissions,
  //         role,
  //         jobTitle, startDate, timeZone,
  //         weeklycommittedHours,
  //       },
  //     ]);
  //   });
  //
  //   test('Should return user profiles if present in cache', async () => {
  //     const users = [
  //       {
  //         _id: '6605f860f948db61dab6f27c',
  //         createdDate: '2024-02-14T05:00:00.000Z',
  //         email: 'dominicsc2hs@gmail.com',
  //         firstName: 'any_first_name',
  //         isActive: true,
  //         lastName: 'any_last_name',
  //         permissions: { frontPermissions: Array(0), backPermissions: Array(0) },
  //         role: 'any_role',
  //         startDate: "2024-02-14T05:00:00.000Z",
  //         timeZone: "America/Los_Angeles",
  //         weeklycommittedHours: 21,
  //       },
  //     ];
  //
  //     // updating our cache
  //     cache.setCache('allusers', JSON.stringify(users));
  //
  //     // user is present in the cache, we should be able to get the data out of it
  //     const response = await agent
  //       .get('/api/userProfile')
  //       .send(reqBody.body)
  //       .set('Authorization', token)
  //       .expect(200);
  //
  //     // in reality we should expect the same as in the previous test, but source code seems to contain a bug
  //     // check line 97 of userProfileController.js
  //
  //     expect(response.body).toEqual([]);
  //   });
  // });
});
