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

  describe('postUserProfile', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/userProfile').send(reqBody.body).expect(401);
    });

    it("should return 404 if route doesn't exists", async () => {
      await agent
        .post('/api/userProfiles')
        .send(reqBody.body)
        .set('Authorization', token)
        .expect(404);
    });

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
});
