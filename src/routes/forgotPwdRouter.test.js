const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  mockUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections },
  createTestPermissions,
  createUser,
} = require('../test');

const agent = request.agent(app);

describe('forgotPwd routes', () => {
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
  });

  afterAll(async () => {
    await dbClearCollections('userProfiles');
    await dbDisconnect();
  });

  describe('API routes', () => {
    it("should return 404 if route doesn't exists", async () => {
      await agent
        .post('/api/forgotpasswords')
        .send(reqBody.body)
        .set('Authorization', token)
        .expect(404);
    });
  });

  describe('postForgotPassword', () => {
    test('Should return 400 when using findOne for user who does not exists in database', async () => {
      // finds user data of a user who does not exists in database
      const response = await agent
        .post('/api/forgotpassword')
        .send(reqBody.body)
        .set('Authorization', token)
        .expect(400);

      expect(response.body.error).toBe('No Valid user was found');
    });

    test('Should return 200 when successfully generated a temp password for user', async () => {
      // adding a user to the database
      let response = await agent
        .post('/api/userProfile')
        .send(reqBody.body)
        .set('Authorization', token)
        .expect(200);

      expect(response.body).toBeTruthy();

      // finds user data of a user who exists in database
      response = await agent
        .post('/api/forgotpassword')
        .send(reqBody.body)
        .set('Authorization', token)
        .expect(200);

      expect(response.body.message).toBe('generated new password');
    });
  });
});
