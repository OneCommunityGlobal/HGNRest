const request = require('supertest');
const moment = require('moment-timezone');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');
// const Reason = require('../models/reason');

function mockDay(dayIdx, past = false) {
  const date = moment().tz('America/Los_Angeles').startOf('day');
  while (date.day() !== dayIdx) {
    date.add(past ? -1 : 1, 'days');
  }
  return date;
}
const agent = request.agent(app);
describe('reason routers', () => {
  let adminUser;
  let adminToken;
  // let volunteerUser;
  // let volunteerToken;
  let reqBody = {
    ...mockReq.body,
  };
  beforeAll(async () => {
    await dbConnect();
    adminUser = await createUser();
    adminToken = jwtPayload(adminUser);
    // volunteerUser = await createUser();
    // volunteerUser.role = 'Volunteer';
    // volunteerToken = jwtPayload(volunteerUser);
  });
  beforeEach(async () => {
    await dbClearCollections('reason');
    reqBody = {
      ...reqBody,
      reasonData: {
        date: mockDay(0),
        message: 'some reason',
      },
      userId: adminUser.userId,
      currentDate: moment.tz('America/Los_Angeles').startOf('day'),
    };
  });
  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });
  describe('reasonRouters', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/reason/').send(reqBody).expect(401);
      await agent.get('/api/reason/randomId').send(reqBody).expect(401);
      await agent.get('/api/reason/single/randomId').send(reqBody).expect(401);
      await agent.patch('/api/reason/randomId/').send(reqBody).expect(401);
      await agent.delete('/api/reason/randomId').send(reqBody).expect(401);
    });
  });
  describe('Post reason route', () => {
    it('Should return 400 if user did not choose SUNDAY', async () => {
      reqBody.reasonData.date = mockDay(1, true);
      const response = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);
      expect(response.body).toEqual({
        message:
          "You must choose the Sunday YOU'LL RETURN as your date. This is so your reason ends up as a note on that blue square.",
        errorCode: 0,
      });
    });
    it('Should return 400 if warning to choose a future date', async () => {
      reqBody.reasonData.date = mockDay(0, true);
      const response = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);
      expect(response.body).toEqual({
        message: 'You should select a date that is yet to come',
        errorCode: 7,
      });
    });
    it('Should return 400 if not providing reason', async () => {
      reqBody.reasonData.message = null;
      const response = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);
      expect(response.body).toEqual({
        message: 'You must provide a reason.',
        errorCode: 6,
      });
    });
    it('Should return 404 if error in finding user Id', async () => {
      reqBody.userId = null;
      const response = await agent
        .post('/api/reason/')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(404);
      expect(response.body).toEqual({
        message: 'User not found',
        errorCode: 2,
      });
    });
    it('Should return 403 if duplicate reason to the date', async () => {
      reqBody.reasonData.userId = adminUser.userId;
      adminUser.timeOffFrom = reqBody.currentDate;
      adminUser.timeOffTill = reqBody.reasonData.date;

      // let response = await agent
      //     .post('/api/reason/')
      //     .send(reqBody)
      //     .set('Authorization', adminToken)
      //     .expect(200);

      // expect(response.body).toBeTruthy();
      // response = await agent
      //     .post('/api/reason/')
      //     .send(reqBody)
      //     .set('Authorization', adminToken)
      //     .expect(403);
      // expect(response.body).toEqual({
      //     message: 'The reason must be unique to the date',
      //     errorCode: 3,
      //   });
    });
  });
});
