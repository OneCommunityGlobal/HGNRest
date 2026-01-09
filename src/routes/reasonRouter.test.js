test.todo('Fix reason routers test suite');
// const request = require('supertest');
// const moment = require('moment-timezone');
// const { jwtPayload } = require('../test');
// const cache = require('../utilities/nodeCache')();
// const { app } = require('../app');
// const {
//   mockReq,
//   mockUser,
//   createUser,
//   createTestPermissions,
//   mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
// } = require('../test');
// // const Reason = require('../models/reason');
//
// function mockDay(dayIdx, past = false) {
//   const date = moment().tz('America/Los_Angeles').startOf('day');
//   while (date.day() !== dayIdx) {
//     date.add(past ? -1 : 1, 'days');
//   }
//   return date;
// }
// const agent = request.agent(app);
// describe('reason routers', () => {
//   let adminUser;
//   let adminToken;
//   let reqBody = {
//     body: {
//       ...mockReq.body,
//       ...mockUser(),
//     },
//   };
//   beforeAll(async () => {
//     await dbConnect();
//     await createTestPermissions();
//     adminUser = await createUser();
//     adminToken = jwtPayload(adminUser);
//   });
//   beforeEach(async () => {
//     await dbClearCollections('reason');
//     await dbClearCollections('userProfiles');
//     cache.setCache('allusers', '[]');
//     reqBody = {
//       body: {
//         ...mockReq.body,
//         ...mockUser(),
//         reasonData: {
//           date: mockDay(0),
//           message: 'some reason',
//         },
//         currentDate: moment.tz('America/Los_Angeles').startOf('day'),
//       },
//     };
//   });
//   afterAll(async () => {
//     await dbClearAll();
//     await dbDisconnect();
//   });
//   describe('reasonRouters', () => {
//     it('should return 401 if authorization header is not present', async () => {
//       await agent.post('/api/reason/').send(reqBody.body).expect(401);
//       await agent.get('/api/reason/randomId').send(reqBody.body).expect(401);
//       await agent.get('/api/reason/single/randomId').send(reqBody.body).expect(401);
//       await agent.patch('/api/reason/randomId/').send(reqBody.body).expect(401);
//       await agent.delete('/api/reason/randomId').send(reqBody.body).expect(401);
//     });
//   });
//   describe('Post reason route', () => {
//     it('Should return 400 if user did not choose SUNDAY', async () => {
//       reqBody.body.reasonData.date = mockDay(1, true);
//       const response = await agent
//         .post('/api/reason/')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(400);
//       expect(response.body).toEqual({
//         message:
//           "You must choose the Sunday YOU'LL RETURN as your date. This is so your reason ends up as a note on that blue square.",
//         errorCode: 0,
//       });
//     });
//     it('Should return 400 if warning to choose a future date', async () => {
//       reqBody.body.reasonData.date = mockDay(0, true);
//       const response = await agent
//         .post('/api/reason/')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(400);
//       expect(response.body).toEqual({
//         message: 'You should select a date that is yet to come',
//         errorCode: 7,
//       });
//     });
//     it('Should return 400 if not providing reason', async () => {
//       reqBody.body.reasonData.message = null;
//       const response = await agent
//         .post('/api/reason/')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(400);
//       expect(response.body).toEqual({
//         message: 'You must provide a reason.',
//         errorCode: 6,
//       });
//     });
//     it('Should return 404 if error in finding user Id', async () => {
//       reqBody.body.userId = null;
//       const response = await agent
//         .post('/api/reason/')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(404);
//       expect(response.body).toEqual({
//         message: 'User not found',
//         errorCode: 2,
//       });
//     });
//     it('Should return 403 if duplicate resonse', async () => {
//       // const userProfile = new userPro
//       let response = await agent
//         .post('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toBeTruthy();
//       response = await agent
//         .get('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//       const userId = response.body[0]._id;
//       reqBody.body.userId = userId;
//       response = await agent
//         .post('/api/reason/')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//       expect(response.body).toBeTruthy();
//       response = await agent
//         .post('/api/reason/')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(403);
//     });
//     it('Should return 200 if post successfully', async () => {
//       let response = await agent
//         .post('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toBeTruthy();
//       response = await agent
//         .get('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//       const userId = response.body[0]._id;
//       reqBody.body.userId = userId;
//       response = await agent
//         .post('/api/reason/')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//     });
//   });
//   describe('Get AllReason route', () => {
//     it('Should return 400 if route does not exist', async () => {
//       const response = await agent
//         .get(`/api/reason/random123`)
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(400);
//       expect(response.body).toEqual({
//         errMessage: 'Something went wrong while fetching the user',
//       });
//     });
//     it('Should return 200 if get all reasons', async () => {
//       let response = await agent
//         .post('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toBeTruthy();
//       response = await agent
//         .get('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//       const userId = response.body[0]._id;
//       reqBody.body.userId = userId;
//       response = await agent
//         .get(`/api/reason/${userId}`)
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//     });
//   });
//   describe('Get Single Reason route', () => {
//     it('Should return 400 if route does not exist', async () => {
//       reqBody.query = {
//         queryDate: mockDay(1, true),
//       };
//       const response = await agent
//         .get(`/api/reason/single/5a7e21f00317bc1538def4b9`)
//         .set('Authorization', adminToken)
//         .expect(404);
//       expect(response.body).toEqual({
//         message: 'User not found',
//         errorCode: 2,
//       });
//     });
//     it('Should return 200 if get all reasons', async () => {
//       let response = await agent
//         .post('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toBeTruthy();
//       response = await agent.get('/api/userProfile').set('Authorization', adminToken).expect(200);
//       const userId = response.body[0]._id;
//       reqBody.body.userId = userId;
//       reqBody.query = {
//         queryDate: mockDay(1, true),
//       };
//       response = await agent
//         .get(`/api/reason/single/${userId}`)
//         .set('Authorization', adminToken)
//         .expect(200);
//     });
//   });
//   describe('Patch reason route', () => {
//     it('Should return 404 if error in finding user Id', async () => {
//       reqBody.body.userId = null;
//       const response = await agent
//         .patch('/api/reason/5a7e21f00317bc1538def4b9/')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(404);
//       expect(response.body).toEqual({
//         message: 'User not found',
//         errorCode: 2,
//       });
//     });
//     it('Should return 404 if duplicate reasons', async () => {
//       let response = await agent
//         .post('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toBeTruthy();
//       response = await agent.get('/api/userProfile').set('Authorization', adminToken).expect(200);
//       const userId = response.body[0]._id;
//       reqBody.body.userId = userId;
//       response = await agent
//         .patch(`/api/reason/${userId}/`)
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(404);
//       expect(response.body).toEqual({
//         message: 'Reason not found',
//         errorCode: 4,
//       });
//     });
//     it('Should return 200 if patch successfully', async () => {
//       let response = await agent
//         .post('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toBeTruthy();
//       response = await agent.get('/api/userProfile').set('Authorization', adminToken).expect(200);
//       const userId = response.body[0]._id;
//       reqBody.body.userId = userId;
//       response = await agent
//         .post(`/api/reason/`)
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//       expect(response.body).toBeTruthy();
//       response = await agent
//         .patch(`/api/reason/${userId}/`)
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//       expect(response.body).toEqual({
//         message: 'Reason Updated!',
//       });
//     });
//   });
//   describe('Delete reason route', () => {
//     it('Should return 404 if route does not exist', async () => {
//       const response = await agent
//         .delete(`/api/reason/5a7e21f00317bc1538def4b9`)
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(404);
//       expect(response.body).toEqual({
//         message: 'User not found',
//         errorCode: 2,
//       });
//     });
//     it('Should return 200 if deleting successfully', async () => {
//       let response = await agent
//         .post('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toBeTruthy();
//       response = await agent
//         .get('/api/userProfile')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//       const userId = response.body[0]._id;
//       reqBody.body.userId = userId;
//       response = await agent
//         .post(`/api/reason/`)
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//       expect(response.body).toBeTruthy();
//       response = await agent
//         .delete(`/api/reason/${userId}`)
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(200);
//       expect(response.body).toEqual({
//         message: 'Document deleted',
//       });
//     });
//   });
// });
