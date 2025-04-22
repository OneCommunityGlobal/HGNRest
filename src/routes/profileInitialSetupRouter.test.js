const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');

const agent = request.agent(app);

describe('profileInitialSetup routes', () => {
  let requestorUser;
  let token;
  let reqBody = {
    ...mockReq.body,
  };

  beforeAll(async () => {
    await dbConnect();
    requestorUser = await createUser(); // requestor user
    token = jwtPayload(requestorUser);
    reqBody = {
      ...reqBody,
      requestor: { requestorId: requestorUser._id, role: requestorUser.role },
      email: 'test@example.com',
      baseUrl: 'http://localhost:3000',
      weeklyCommittedHours: 10,
    };
  });

  beforeEach(async () => {
    await dbClearCollections('profileInitialSetupTokens', 'userProfiles', 'projects', 'mapLocations');
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('getInitialSetuptoken', () => {
    it('Should return 404 if the route does not exist', async () => {
      await agent.post('/api/getInitialSetuptokens').send(reqBody).set('Authorization', token).expect(404);
    });
  });

  describe('validateToken', () => {
    it('Should return 404 if the route does not exist', async () => {
      await agent.post('/api/validateTokens').send({ token: 'test-token' }).set('Authorization', token).expect(404);
    });

    it('Should return 404 if token is not found', async () => {
      const response = await agent
        .post('/api/validateToken')
        .send({ token: 'non-existent-token' })
        .set('Authorization', token)
        .expect(404);

      expect(response.text).toBe('NOT_FOUND');
    });
  });

  describe('getTimeZoneAPIKeyByToken', () => {
    it('Should return 404 if the route does not exist', async () => {
      await agent.post('/api/getTimeZoneAPIKeyByTokens').send({ token: 'test-token' }).set('Authorization', token).expect(404);
    });

    it('Should return 403 if token is not found', async () => {
      const response = await agent
        .post('/api/getTimeZoneAPIKeyByToken')
        .send({ token: 'non-existent-token' })
        .set('Authorization', token)
        .expect(403);

      expect(response.text).toBe('Unauthorized Request');
    });
  });

  describe('getTotalCountryCount', () => {
    it('Should return 404 if the route does not exist', async () => {
      await agent.get('/api/getTotalCountryCounts').set('Authorization', token).expect(404);
    });

    it('Should return country count on success', async () => {
      const response = await agent
        .get('/api/getTotalCountryCount')
        .set('Authorization', token)
        .expect(200);

      expect(response.body).toEqual({
        CountryCount: expect.any(Number),
      });
    });
  });

  describe('getSetupInvitation', () => {
    it('Should return 404 if the route does not exist', async () => {
      await agent.get('/api/getSetupInvitations').set('Authorization', token).expect(404);
    });
  });

  describe('refreshSetupInvitationToken', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/refreshSetupInvitationToken').send({ token: 'test-token' }).expect(401);
    });

    it('Should return 404 if the route does not exist', async () => {
      await agent.post('/api/refreshSetupInvitationTokens').send({ token: 'test-token' }).set('Authorization', token).expect(404);
    });
  });

  describe('cancelSetupInvitationToken', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/cancelSetupInvitationToken').send({ token: 'test-token' }).expect(401);
    });

    it('Should return 404 if the route does not exist', async () => {
      await agent.post('/api/cancelSetupInvitationTokens').send({ token: 'test-token' }).set('Authorization', token).expect(404);
    });
  });
}); 