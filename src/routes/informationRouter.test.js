test.todo("Fix information router tests.");
// const request = require('supertest');
// const { jwtPayload } = require('../test');
// const cache = require('../utilities/nodeCache')();
// const { app } = require('../app');
// const {
//   mockReq,
//   createUser,
//   mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
// } = require('../test');
//
// const agent = request.agent(app);
//
// describe('information routes', () => {
//   let user;
//   let token;
//   let reqBody = {
//     ...mockReq.body,
//   };
//   beforeAll(async () => {
//     await dbConnect();
//     user = await createUser();
//     token = jwtPayload(user);
//     reqBody = {
//       ...reqBody,
//       infoName: 'some infoName',
//       infoContent: 'some infoContent',
//       visibility: '1',
//     };
//   });
//   beforeEach(async () => {
//     await dbClearCollections('informations');
//   });
//
//   afterAll(async () => {
//     await dbClearAll();
//     await dbDisconnect();
//   });
//   describe('informationRoutes', () => {
//     it('should return 401 if authorization header is not present', async () => {
//       await agent.post('/api/informations').send(reqBody).expect(401);
//       await agent.get('/api/informations/randomID').send(reqBody).expect(401);
//     });
//   });
//   describe('Post Information route', () => {
//     it('Should return 201 if the information is successfully added', async () => {
//       const response = await agent
//         .post('/api/informations')
//         .send(reqBody)
//         .set('Authorization', token)
//         .expect(201);
//
//       expect(response.body).toEqual({
//         _id: expect.anything(),
//         __v: expect.anything(),
//         infoName: reqBody.infoName,
//         infoContent: reqBody.infoContent,
//         visibility: reqBody.visibility,
//       });
//     });
//   });
//   describe('Get Information route', () => {
//     it('Should return 201 if the information is successfully added', async () => {
//       const informations = [
//         {
//           _id: '6605f860f948db61dab6f27m',
//           infoName: 'get info',
//           infoContent: 'get infoConten',
//           visibility: '1',
//         },
//       ];
//       cache.setCache('informations', JSON.stringify(informations));
//       const response = await agent
//         .get('/api/informations')
//         .send(reqBody)
//         .set('Authorization', token)
//         .expect(200);
//       expect(response.body).toEqual({});
//     });
//   });
//   describe('Delete Information route', () => {
//     it('Should return 400 if the route does not exist', async () => {
//       await agent
//         .delete('/api/informations/random123')
//         .send(reqBody)
//         .set('Authorization', token)
//         .expect(400);
//     });
//     // thrown: "Exceeded timeout of 5000 ms for a test.
//     // Add a timeout value to this test to increase the timeout, if this is a long-running test. See https://jestjs.io/docs/api#testname-fn-timeout."
//     // it('Should return 200 if deleting successfully', async () => {
//     //     const _info = new Information();
//     //     _info.infoName = reqBody.infoName;
//     //     _info.infoContent = reqBody.infoContent;
//     //     _info.visibility = reqBody.visibility;
//     //     const info = await _info.save();
//     //     const response = await agent
//     //       .delete(`/api/informations/${info._id}`)
//     //       .set('Authorization', token)
//     //       .send(reqBody)
//     //       .expect(200);
//
//     //     expect(response.body).toEqual(
//     //         {
//     //         _id: expect.anything(),
//     //         __v: expect.anything(),
//     //         infoName: info.infoName,
//     //         infoContent: info.infoContent,
//     //         visibility: info.visibility,
//     //     });
//     // });
//   });
//   describe('Update Information route', () => {
//     it('Should return 400 if the route does not exist', async () => {
//       await agent
//         .put('/api/informations/random123')
//         .send(reqBody)
//         .set('Authorization', token)
//         .expect(400);
//     });
//     // thrown: "Exceeded timeout of 5000 ms for a test.
//     // Add a timeout value to this test to increase the timeout, if this is a long-running test. See https://jestjs.io/docs/api#testname-fn-timeout."
//     // it('Should return 200 if udapted successfully', async () => {
//     //     const _info = new Information();
//     //     _info.infoName = reqBody.infoName;
//     //     _info.infoContent = reqBody.infoContent;
//     //     _info.visibility = reqBody.visibility;
//     //     const info = await _info.save();
//
//     //     const response = await agent
//     //       .put(`/api/informations/${info.id}`)
//     //       .send(reqBody)
//     //       .set('Authorization', token)
//     //       .expect(200);
//     //     expect(response.body).toEqual(
//     //         {
//     //         _id: expect.anything(),
//     //         __v: expect.anything(),
//     //         infoName: info.infoName,
//     //         infoContent: info.infoContent,
//     //         visibility: info.visibility,
//     //     });
//
//     // });
//   });
// });
