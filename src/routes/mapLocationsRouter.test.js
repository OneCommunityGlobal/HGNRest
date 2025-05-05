jest.mock('../controllers/lbdashboard/lbMessageController', () => ({
  markMessageAsRead: jest.fn(),
}));

const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearAll },
} = require('../test');
const MapLocation = require('../models/mapLocation');

const agent = request.agent(app);

// TODO: Fix
describe('mapLocations tests', () => {
  test.todo('Fix this test suite');
});


// describe('mapLocations routes', () => {
//   let ownerUser;
//   let volunteerUser;
//   let ownerToken;
//   let volunteerToken;
//   let reqBody = {
//     ...mockReq.body,
//   };
//
//   beforeAll(async () => {
//     await dbConnect();
//     ownerUser = await createUser();
//     volunteerUser = await createUser();
//     ownerUser.role = 'Owner';
//     volunteerUser.role = 'Volunteer';
//     ownerToken = jwtPayload(ownerUser);
//     volunteerToken = jwtPayload(volunteerUser);
//     reqBody = {
//       ...reqBody,
//       firstName: volunteerUser.firstName,
//       lastName: volunteerUser.lastName,
//       jobTitle: 'Software Engineer',
//       location: {
//         userProvided: 'A',
//         coords: {
//           lat: '51',
//           lng: '110',
//         },
//         country: 'Test',
//         city: 'Usa',
//       },
//       _id: volunteerUser._id,
//       type: 'user',
//     };
//   });
//
//   afterAll(async () => {
//     await dbClearAll();
//     await dbDisconnect();
//   });
//
//   describe('mapLocationRoutes', () => {
//     it('should return 401 if authorization header is not present', async () => {
//       await agent.get('/api/mapLocations').send(reqBody).expect(401);
//       await agent.put('/api/mapLocations').send(reqBody).expect(401);
//       await agent.patch('/api/mapLocations').send(reqBody).expect(401);
//       await agent.delete('/api/mapLocations/123').send(reqBody).expect(401);
//     });
//
//     it('should return 404 if the route does not exist', async () => {
//       await agent
//         .get('/api/mapLocation')
//         .set('Authorization', volunteerToken)
//         .send(reqBody)
//         .expect(404);
//       await agent
//         .put('/api/mapLocation')
//         .set('Authorization', volunteerToken)
//         .send(reqBody)
//         .expect(404);
//       await agent
//         .patch('/api/mapLocation')
//         .set('Authorization', volunteerToken)
//         .send(reqBody)
//         .expect(404);
//       await agent
//         .delete('/api/mapLocation/123')
//         .set('Authorization', volunteerToken)
//         .send(reqBody)
//         .expect(404);
//     });
//   });
//
//   describe('getMapLocation routes', () => {
//     it('Should return 200 and the users on success', async () => {
//       const expected = {
//         mUsers: [],
//         users: [
//           {
//             location: {
//               city: '',
//               coords: {
//                 lat: 51,
//                 lng: 110,
//               },
//               country: '',
//               userProvided: '',
//             },
//             isActive: ownerUser.isActive,
//             jobTitle: ownerUser.jobTitle[0],
//             _id: ownerUser._id.toString(),
//             firstName: ownerUser.firstName,
//             lastName: ownerUser.lastName,
//           },
//           {
//             location: {
//               city: '',
//               coords: {
//                 lat: 51,
//                 lng: 110,
//               },
//               country: '',
//               userProvided: '',
//             },
//             isActive: volunteerUser.isActive,
//             jobTitle: volunteerUser.jobTitle[0],
//             _id: volunteerUser._id.toString(),
//             firstName: volunteerUser.firstName,
//             lastName: volunteerUser.lastName,
//           },
//         ],
//       };
//
//       const response = await agent
//         .get('/api/mapLocations')
//         .set('Authorization', ownerToken)
//         .send(reqBody)
//         .expect(200);
//
//       expect(response.body).toEqual(expected);
//     });
//   });
//
//   describe('putMapLocation route', () => {
//     it('Should return 200 on success', async () => {
//       const response = await agent
//         .put('/api/mapLocations')
//         .set('Authorization', ownerToken)
//         .send(reqBody)
//         .expect(200);
//
//       const expected = {
//         _id: expect.anything(),
//         __v: expect.anything(),
//         firstName: reqBody.firstName,
//         lastName: reqBody.lastName,
//         jobTitle: reqBody.jobTitle,
//         location: reqBody.location,
//         isActive: false,
//         title: 'Prior to HGN Data Collection',
//       };
//
//       expect(response.body).toEqual(expected);
//     });
//   });
//
//   describe('patchMapLocation route', () => {
//     it('Should return 200 on success', async () => {
//       reqBody.location.coords.lat = 51;
//       reqBody.location.coords.lng = 110;
//       const res = await agent
//         .patch('/api/mapLocations')
//         .set('Authorization', ownerToken)
//         .send(reqBody)
//         .expect(200);
//
//       const expected = {
//         firstName: reqBody.firstName,
//         lastName: reqBody.lastName,
//         jobTitle: [reqBody.jobTitle],
//         location: reqBody.location,
//         _id: reqBody._id.toString(),
//         type: reqBody.type,
//       };
//
//       expect(res.body).toEqual(expected);
//     });
//   });
//
//   describe('Delete map locations route', () => {
//     it('Should return 200 on success', async () => {
//       const _map = new MapLocation();
//       _map.firstName = reqBody.firstName;
//       _map.lastName = reqBody.lastName;
//       _map.location = reqBody.location;
//       _map.jobTitle = reqBody.jobTitle;
//
//       const map = await _map.save();
//
//       const res = await agent
//         .delete(`/api/mapLocations/${map._id}`)
//         .set('Authorization', ownerToken)
//         .send(reqBody);
//
//       expect(res.body).toEqual({ message: 'The location was successfully removed!' });
//     });
//   });
// });
