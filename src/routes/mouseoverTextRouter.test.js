const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');
const MouseoverText = require('../models/mouseoverText');

const agent = request.agent(app);

describe('mouseoverText routes', () => {
  let adminUser;
  let adminToken;
  let reqBody = {
    ...mockReq.body,
  };

  beforeAll(async () => {
    await dbConnect();
    adminUser = await createUser();
    adminToken = jwtPayload(adminUser);
  });

  beforeEach(async () => {
    await dbClearCollections('mouseoverText');
    reqBody = {
      ...reqBody,
      newMouseoverText: 'new mouseoverText',
    };
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('mouseoverTextRoutes', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/mouseoverText').send(reqBody).expect(401);
      await agent.get('/api/mouseoverText').send(reqBody).expect(401);
      await agent.put(`/api/mouseoverText/randomId`).send(reqBody).expect(401);
    });
  });
  describe('createMouseoverText route', () => {
    it('Should return 201 if create new mouseoverText successfully', async () => {
      const _mouseoverText = new MouseoverText();
      _mouseoverText.mouseoverText = 'sample mouseoverText';
      await _mouseoverText.save();
      const response = await agent
        .post('/api/mouseoverText')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(201);

      expect(response.body).toEqual({
        mouseoverText: {
          _id: expect.anything(),
          __v: expect.anything(),
          mouseoverText: reqBody.newMouseoverText,
        },
        _serverMessage: 'MouseoverText successfully created!',
      });
    });
  });
  describe('getMouseoverText route', () => {
    it('Should return 201 if create new mouseoverText successfully', async () => {
      const _mouseoverText = new MouseoverText();
      _mouseoverText.mouseoverText = 'sample mouseoverText';
      await _mouseoverText.save();
      await agent.get('/api/mouseoverText').set('Authorization', adminToken).expect(200);
    });
  });
  describe('updateMouseoverText route', () => {
    it('Should return 500 if any error in finding mouseoverText by Id', async () => {
      reqBody.newMouseoverText = null;
      const response = await agent
        .put('/api/mouseoverText/randomId')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(500);
      expect(response.body).toEqual({ error: 'MouseoverText not found with the given ID' });
    });
    it('Should return 201 if updating mouseoverText successfully', async () => {
      const _mouseoverText = new MouseoverText();
      _mouseoverText.mouseoverText = 'sample mouseoverText';
      const mouseoverText = await _mouseoverText.save();
      const response = await agent
        .put(`/api/mouseoverText/${mouseoverText._id}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(201);
      expect(response.body).toEqual({
        _id: expect.anything(),
        __v: expect.anything(),
        mouseoverText: reqBody.newMouseoverText,
      });
    });
  });
});
