test.todo('Fix time zone API routes tests');
// const request = require('supertest');
// const { jwtPayload } = require('../test');
//
// const originalPremiumKey = process.env.TIMEZONE_PREMIUM_KEY;
//
// const { app } = require('../app');
// const {
//   mockReq,
//   mongoHelper: { dbConnect, dbDisconnect },
//   createTestPermissions,
//   createUser,
//   mockUser,
// } = require('../test');
//
// const UserProfile = require('../models/userProfile');
// const ProfileInitialSetupToken = require('../models/profileInitialSetupToken');
//
// const agent = request.agent(app);
//
// describe('timeZoneAPI routes', () => {
//   let adminUser;
//   let adminToken;
//   let volunteerUser;
//   let volunteerToken;
//
//   const reqBody = {};
//   const incorrectLocationParams = 'r';
//   const locationParamsThatResultsInNoMatch = 'someReallyRandomLocation';
//   const correctLocationParams = 'Berlin,+Germany';
//
//   beforeAll(async () => {
//     await dbConnect();
//     await createTestPermissions();
//
//     reqBody.body = {
//       // This is the user we want to create
//       ...mockReq.body,
//     };
//     adminUser = await createUser(); // This is the admin requestor user
//     adminToken = jwtPayload(adminUser);
//
//     volunteerUser = mockUser(); // This is the admin requestor user
//     volunteerUser.email = 'volunteer@onecommunity.com';
//     volunteerUser.role = 'Volunteer';
//     volunteerUser = new UserProfile(volunteerUser);
//     volunteerUser = await volunteerUser.save();
//     volunteerToken = jwtPayload(volunteerUser);
//   });
//
//   afterAll(async () => {
//     await dbDisconnect();
//
//     if (originalPremiumKey) {
//       process.env.TIMEZONE_PREMIUM_KEY = originalPremiumKey;
//     } else {
//       delete process.env.TIMEZONE_PREMIUM_KEY;
//     }
//   });
//
//   describe('API routes', () => {
//     it("should return 404 if route doesn't exist", async () => {
//       await agent
//         .post('/api/timezonesss')
//         .send(reqBody.body)
//         .set('Authorization', adminToken)
//         .expect(404);
//     });
//   });
//
//   describe('getTimeZone - request parameter `location` based tests', () => {
//     test('401 when `API key` is missing', async () => {
//       const location = 'Berlin,+Germany';
//       delete process.env.TIMEZONE_PREMIUM_KEY;
//
//       const response = await agent
//         .get(`/api/timezone/${location}`)
//         .set('Authorization', adminToken)
//         .send(reqBody.body)
//         .expect(401);
//
//       expect(response.error.text).toBe('API Key Missing');
//     });
//
//     // TODO: Fix
//     // test('400 when `location` is incorrect', async () => {
//     //   const response = await agent
//     //     .get(`/api/timezone/${incorrectLocationParams}`) // Make sure this is the intended test
//     //     .set('Authorization', volunteerToken)
//     //     .send(reqBody.body)
//     //     .expect(400);
//     //
//     //   expect(response.error.text).toBeTruthy();
//     // });
//     //
//     // test('200 when `location` is correctly formatted', async () => {
//     //   const response = await agent
//     //     .get(`/api/timezone/${correctLocationParams}`) // Make sure this is the intended test
//     //     .set('Authorization', volunteerToken)
//     //     .send(reqBody.body)
//     //     .expect(200);
//     //
//     //   expect(response).toBeTruthy();
//     //   expect(response._body.timezone).toBeTruthy();
//     //   expect(response._body.currentLocation).toBeTruthy();
//     //   expect(response._body.currentLocation.userProvided).toBe(correctLocationParams);
//     // });
//     //
//     // test('404 when results.length === 0', async () => {
//     //   const response = await agent
//     //     .get(`/api/timezone/${locationParamsThatResultsInNoMatch}`) // Make sure this is the intended test
//     //     .set('Authorization', volunteerToken)
//     //     .send(reqBody.body)
//     //     .expect(404);
//     //
//     //   expect(response).toBeTruthy();
//     // });
//   });
//
//   describe('getTimeZoneProfileInitialSetup - token is missing in body or in ProfileInitialSetupToken', () => {
//     test('401 when `token` is missing in request body', async () => {
//       const location = 'Berlin,+Germany';
//
//       const response = await agent
//         .post(`/api/timezone/${location}`)
//         .set('Authorization', adminToken)
//         .send(reqBody.body)
//         .expect(400);
//
//       expect(response.error.text).toBe('Missing token');
//     });
//
//     test('403 when ProfileInitialSetupToken does not contains `req.body.token`', async () => {
//       const location = 'Berlin,+Germany';
//       reqBody.body = {
//         ...reqBody,
//         token: 'randomToken',
//       };
//
//       const response = await agent
//         .post(`/api/timezone/${location}`)
//         .set('Authorization', adminToken)
//         .send(reqBody.body)
//         .expect(403);
//
//       expect(response.error.text).toBe('Unauthorized Request');
//     });
//   });
//
//   // TODO: Fix
//   // describe('getTimeZoneProfileInitialSetup - token is present in ProfileInitialSetupToken', () => {
//   //   const tokenData = 'randomToken';
//   //
//   //   beforeAll(async () => {
//   //     const expirationDate = new Date().setDate(new Date().getDate() + 10);
//   //
//   //     let data = {
//   //       token: tokenData,
//   //       email: 'randomEmail',
//   //       weeklyCommittedHours: 5,
//   //       expiration: expirationDate,
//   //       createdDate: new Date(),
//   //       isCancelled: false,
//   //       isSetupCompleted: true,
//   //     };
//   //
//   //     data = new ProfileInitialSetupToken(data);
//   //
//   //     // eslint-disable-next-line no-unused-vars
//   //     data = await data.save();
//   //
//   //     reqBody.body = {
//   //       ...reqBody,
//   //       token: tokenData,
//   //     };
//   //   });
//   //
//   //   test('400 when `location` is incorrect', async () => {
//   //     const response = await agent
//   //       .get(`/api/timezone/${incorrectLocationParams}`) // Make sure this is the intended test
//   //       .set('Authorization', volunteerToken)
//   //       .send(reqBody.body)
//   //       .expect(400);
//   //
//   //     expect(response.error.text).toBeTruthy();
//   //   });
//   //
//   //   test('200 when `location` is correctly formatted', async () => {
//   //     const response = await agent
//   //       .get(`/api/timezone/${correctLocationParams}`) // Make sure this is the intended test
//   //       .set('Authorization', volunteerToken)
//   //       .send(reqBody.body)
//   //       .expect(200);
//   //
//   //     expect(response).toBeTruthy();
//   //     expect(response._body.timezone).toBeTruthy();
//   //     expect(response._body.currentLocation).toBeTruthy();
//   //     expect(response._body.currentLocation.userProvided).toBe(correctLocationParams);
//   //   });
//   //
//   //   test('404 when results.length === 0', async () => {
//   //     const response = await agent
//   //       .get(`/api/timezone/${locationParamsThatResultsInNoMatch}`) // Make sure this is the intended test
//   //       .set('Authorization', volunteerToken)
//   //       .send(reqBody.body)
//   //       .expect(404);
//   //
//   //     expect(response).toBeTruthy();
//   //   });
//   // });
// });
