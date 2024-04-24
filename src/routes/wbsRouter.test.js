const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');

const agent = request.agent(app);

describe('actionItem routes', () => {
  let user;
  let token;
  const reqBody = {
    ...mockReq.body,
  };

  beforeAll(async () => {
    await dbConnect();
    user = await createUser();
    token = jwtPayload(user);
    // reqBody = {
    //   ...reqBody,
    //   requestor: { requestorId: requestorUser._id, assignedTo: assignedUser._id },
    //   description: 'Any description',
    //   assignedTo: assignedUser._id,
    // };
  });

  beforeEach(async () => {
    await dbClearCollections('actionItems');
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('wbsRouter tests', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.get('/api/wbs/randomId').send(reqBody).expect(401);
      await agent.post('/api/wbs/randomId').send(reqBody).expect(401);
      await agent.delete('/api/wbs/randomId').send(reqBody).expect(401);
      await agent.get('/api/wbsId/randomId').send(reqBody).expect(401);
      await agent.get('/api/wbs/user/randomId').send(reqBody).expect(401);
      await agent.get('/api/wbs').send(reqBody).expect(401);
    });

    it('should return 404 if the route does not exist', async () => {
      await agent.get('/api/wibs/randomId').set('Authorization', token).send(reqBody).expect(404);
      await agent.post('/api/wibs/randomId').set('Authorization', token).send(reqBody).expect(404);
      await agent
        .delete('/api/wibs/randomId')
        .set('Authorization', token)
        .send(reqBody)
        .expect(404);
      await agent.get('/api/wibsId/randomId').set('Authorization', token).send(reqBody).expect(404);
      await agent
        .get('/api/wibs/user/randomId')
        .set('Authorization', token)
        .send(reqBody)
        .expect(404);
      await agent.get('/api/wibs').set('Authorization', token).send(reqBody).expect(404);
    });
    // describe('getAllWBS routes', () => {});
  });
});
