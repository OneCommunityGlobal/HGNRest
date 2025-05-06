
const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  createRole,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');
const RolePreset = require('../models/rolePreset');

const agent = request.agent(app);

// TODO: Fix whole file
describe('rolePreset tests', () => {
  test.todo('Fix this test suite');
});
// describe('rolePreset routes', () => {
//   let adminUser;
//   let adminToken;
//   let volunteerUser;
//   let volunteerToken;
//   let reqBody = {
//     ...mockReq.body,
//   };
//
//   beforeAll(async () => {
//     await dbConnect();
//     adminUser = await createUser();
//     volunteerUser = await createUser();
//     volunteerUser.role = 'Volunteer';
//     adminToken = jwtPayload(adminUser);
//     volunteerToken = jwtPayload(volunteerUser);
//     // create 2 roles. One with permission and one without
//     await createRole('Administrator', ['putRole']);
//     await createRole('Volunteer', []);
//   });
//
//   beforeEach(async () => {
//     await dbClearCollections('rolePreset');
//     reqBody = {
//       ...reqBody,
//       roleName: 'some roleName',
//       presetName: 'some Preset',
//       permissions: ['test', 'write'],
//     };
//   });
//
//   afterAll(async () => {
//     await dbClearAll();
//     await dbDisconnect();
//   });
//
//   describe('rolePresetRoutes', () => {
//     it('should return 401 if authorization header is not present', async () => {
//       await agent.post('/api/rolePreset').send(reqBody).expect(401);
//       await agent.get('/api/rolePreset/randomRoleName').send(reqBody).expect(401);
//       await agent.put(`/api/rolePreset/randomId`).send(reqBody).expect(401);
//       await agent.delete('/api/rolePreser/randomId').send(reqBody).expect(401);
//     });
//   });
//
//   describe('Post rolePreset route', () => {
//     it('Should return 403 if user does not have permissions', async () => {
//       const response = await agent
//         .post('/api/rolePreset')
//         .send(reqBody)
//         .set('Authorization', volunteerToken)
//         .expect(403);
//       expect(response.text).toEqual('You are not authorized to make changes to roles.');
//     });
//
//     it('Should return 400 if missing roleName', async () => {
//       reqBody.roleName = null;
//       const response = await agent
//         .post('/api/rolePreset')
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(400);
//
//       expect(response.body).toEqual({
//         error: 'roleName, presetName, and permissions are mandatory fields.',
//       });
//     });
//
//     it('Should return 400 if missing presetName', async () => {
//       reqBody.presetName = null;
//       const response = await agent
//         .post('/api/rolePreset')
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(400);
//
//       expect(response.body).toEqual({
//         error: 'roleName, presetName, and permissions are mandatory fields.',
//       });
//     });
//
//     it('Should return 400 if missing permissions', async () => {
//       reqBody.permissions = null;
//       const response = await agent
//         .post('/api/rolePreset')
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(400);
//
//       expect(response.body).toEqual({
//         error: 'roleName, presetName, and permissions are mandatory fields.',
//       });
//     });
//
//     it('Should return 201 if the rolePreset is successfully created', async () => {
//       const response = await agent
//         .post('/api/rolePreset')
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(201);
//
//       expect(response.body).toEqual({
//         newPreset: {
//           _id: expect.anything(),
//           __v: expect.anything(),
//           roleName: reqBody.roleName,
//           presetName: reqBody.presetName,
//           permissions: reqBody.permissions,
//         },
//         message: 'New preset created',
//       });
//     });
//   });
//
//   describe('get Presets ByRole route', () => {
//     it('Should return 403 if user does not have permissions', async () => {
//       const response = await agent
//         .post('/api/rolePreset')
//         .send(reqBody)
//         .set('Authorization', volunteerToken)
//         .expect(403);
//
//       expect(response.text).toEqual('You are not authorized to make changes to roles.');
//     });
//
//     it('Should return 200 if getPreset By role successfully', async () => {
//       const _rolePreset = new RolePreset();
//       _rolePreset.roleName = 'sample roleName';
//       _rolePreset.presetName = 'sample presetName';
//       _rolePreset.permissions = ['sample permissions'];
//       const rolePreset = await _rolePreset.save();
//       const response = await agent
//         .get(`/api/rolePreset/${rolePreset.roleName}`)
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toEqual([
//         {
//           _id: expect.anything(),
//           __v: expect.anything(),
//           roleName: rolePreset.roleName,
//           presetName: rolePreset.presetName,
//           permissions: expect.arrayContaining(rolePreset.permissions),
//         },
//       ]);
//     });
//   });
//   describe('update Preset route', () => {
//     it('Should return 403 if user does not have permissions', async () => {
//       const response = await agent
//         .post('/api/rolePreset')
//         .send(reqBody)
//         .set('Authorization', volunteerToken)
//         .expect(403);
//
//       expect(response.text).toEqual('You are not authorized to make changes to roles.');
//     });
//
//     it('Should return 400 if the route does not exist', async () => {
//       await agent
//         .put('/api/rolePreset/randomId123')
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(400);
//     });
//
//     it('Should return 200 if update Preset By Id successfully', async () => {
//       const _rolePreset = new RolePreset();
//       _rolePreset.roleName = reqBody.roleName;
//       _rolePreset.presetName = reqBody.presetName;
//       _rolePreset.permissions = reqBody.permissions;
//       const rolePreset = await _rolePreset.save();
//       const response = await agent
//         .put(`/api/rolePreset/${rolePreset._id}`)
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toEqual({
//         _id: expect.anything(),
//         __v: expect.anything(),
//         roleName: reqBody.roleName,
//         presetName: reqBody.presetName,
//         permissions: expect.arrayContaining(reqBody.permissions),
//       });
//     });
//   });
//   describe('delete Preset route', () => {
//     it('Should return 403 if user does not have permissions', async () => {
//       const response = await agent
//         .post('/api/rolePreset')
//         .send(reqBody)
//         .set('Authorization', volunteerToken)
//         .expect(403);
//
//       expect(response.text).toEqual('You are not authorized to make changes to roles.');
//     });
//
//     it('Should return 400 if the route does not exist', async () => {
//       await agent
//         .delete('/api/rolePreset/randomId123')
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(400);
//     });
//
//     it('Should return 200 if update Preset By Id successfully', async () => {
//       const _rolePreset = new RolePreset();
//       _rolePreset.roleName = reqBody.roleName;
//       _rolePreset.presetName = reqBody.presetName;
//       _rolePreset.permissions = reqBody.permissions;
//       const rolePreset = await _rolePreset.save();
//
//       const response = await agent
//         .delete(`/api/rolePreset/${rolePreset._id}`)
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toEqual({
//         message: 'Deleted preset',
//       });
//     });
//   });
// });
