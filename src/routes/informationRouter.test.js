const request = require('supertest');
const { jwtPayload } = require('../test');
const cache = require('../utilities/nodeCache')();
const { app } = require('../app');
const {
  mockReq,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
  createInformation,
  createUser,
} = require('../test');

const agent = request.agent(app);

describe('information routes', () => {
  let requestInformation;
  let requestorUser;
  let token;
  let reqBody = {
    ...mockReq.body,
  };

  beforeAll(async () => {
    await dbConnect();
    requestorUser = await createUser(); // requestor user
    token = jwtPayload(requestorUser);
    requestInformation = await createInformation();
    reqBody = {
      ...reqBody,
      description: 'test Info',
    };
  });

  beforeEach(async () => {
    await dbClearCollections('informations');
    cache.setCache('informations', '[]');
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('getInformation', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.get('/api/informations').send(reqBody.body).expect(401);
    });

    it("should return 404 if route doesn't exists", async () => {
      await agent
        .post(`/api/informations/${requestInformation._id}`)
        .set('Authorization', token)
        .expect(404);
    });
  });
});
