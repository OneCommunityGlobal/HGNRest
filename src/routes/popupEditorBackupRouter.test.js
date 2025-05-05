jest.mock('../controllers/lbdashboard/lbMessageController', () => ({
  markMessageAsRead: jest.fn(),
}));

const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  createRole,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');
const PopupEditorBackups = require('../models/popupEditorBackup');

const agent = request.agent(app);

// TODO: Fix
describe('PopupEditorBackups tests', () => {
  test.todo('Fix this test suite');
});

// describe('PopupEditorBackups routes', () => {
//   let adminUser;
//   let adminToken;
//   let volunteerUser;
//   let volunteerToken;
//   let reqBody = {
//     ...mockReq.body,
//   };
//   beforeAll(async () => {
//     await dbConnect();
//     adminUser = await createUser();
//     volunteerUser = await createUser();
//     volunteerUser.role = 'Volunteer';
//     adminToken = jwtPayload(adminUser);
//     volunteerToken = jwtPayload(volunteerUser);
//     // create 2 roles. One with permission and one without
//     await createRole('Administrator', ['updatePopup', 'createPopup']);
//     await createRole('Volunteer', []);
//   });
//   beforeEach(async () => {
//     await dbClearCollections('popupEditorBackup');
//     reqBody = {
//       ...reqBody,
//       popupId: '6437f9af9820a0134ca79c5e',
//       popupName: 'popupName',
//       popupContent: 'some popupContent',
//     };
//   });
//   afterAll(async () => {
//     await dbClearAll();
//     await dbDisconnect();
//   });
//   describe('PopupEditorBackupRoutes', () => {
//     it('should return 401 if authorization header is not present', async () => {
//       await agent.post('/api/backup/popupeditors/').send(reqBody).expect(401);
//       await agent.get('/api/backup/popupeditors/').send(reqBody).expect(401);
//       await agent.post('/api/backup/popupeditor/randomId').send(reqBody).expect(401);
//       await agent.get('/api/backup/popupeditor/randomId').send(reqBody).expect(401);
//     });
//   });
//   describe('Post PopupEditorBackups route', () => {
//     it('Should return 403 if user does not have permissions', async () => {
//       const response = await agent
//         .post('/api/backup/popupeditors/')
//         .send(reqBody)
//         .set('Authorization', volunteerToken)
//         .expect(403);
//       expect(response.body).toEqual({ error: 'You are not authorized to create new popup' });
//     });
//     it('Should return 400 if missing popupName', async () => {
//       reqBody.popupName = null;
//       const response = await agent
//         .post('/api/backup/popupeditors/')
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(400);
//
//       expect(response.body).toEqual({
//         error: 'popupName , popupContent are mandatory fields',
//       });
//     });
//     it('Should return 400 if missing popupContent', async () => {
//       reqBody.popupContent = null;
//       const response = await agent
//         .post('/api/backup/popupeditors/')
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(400);
//
//       expect(response.body).toEqual({
//         error: 'popupName , popupContent are mandatory fields',
//       });
//     });
//     it('Should return 201 if the PopupEditorBackup is successfully created', async () => {
//       const _popupEditorBackups = new PopupEditorBackups();
//       _popupEditorBackups.popupId = reqBody.popupId;
//       _popupEditorBackups.popupName = reqBody.popupName;
//       _popupEditorBackups.popupContent = reqBody.popupContent;
//       const popupEditorBackups = await _popupEditorBackups.save();
//       const response = await agent
//         .post('/api/backup/popupeditors/')
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(201);
//
//       expect(response.body).toEqual({
//         _id: expect.anything(),
//         __v: expect.anything(),
//         popupId: popupEditorBackups.popupId.toString(),
//         popupName: popupEditorBackups.popupName,
//         popupContent: popupEditorBackups.popupContent,
//       });
//     });
//   });
//   describe('getAllPopupEditorBackups route', () => {
//     it('Should return 201 if the get AllPopupEditorBackups successfully ', async () => {
//       const _popupEditorBackups = new PopupEditorBackups();
//       _popupEditorBackups.popupName = reqBody.popupName;
//       _popupEditorBackups.popupContent = reqBody.popupContent;
//       _popupEditorBackups.popupId = reqBody.popupId;
//       const popupEditorBackups = await _popupEditorBackups.save();
//       const response = await agent
//         .get('/api/backup/popupeditors/')
//         .set('Authorization', adminToken)
//         .expect(200);
//
//       expect(response.body).toEqual([
//         {
//           _id: expect.anything(),
//           __v: expect.anything(),
//           popupId: popupEditorBackups.popupId.toString(),
//           popupName: popupEditorBackups.popupName,
//           popupContent: popupEditorBackups.popupContent,
//         },
//       ]);
//     });
//   });
//   describe('getPopupEditorBackupById route', () => {
//     it('Should return 201 if the get PopupEditorBackup by id is successfully created', async () => {
//       const _popupEditorBackups = new PopupEditorBackups();
//       _popupEditorBackups.popupId = reqBody.popupId;
//       _popupEditorBackups.popupName = reqBody.popupName;
//       _popupEditorBackups.popupContent = reqBody.popupContent;
//       const popupEditorBackups = await _popupEditorBackups.save();
//
//       const response = await agent
//         .get(`/api/backup/popupeditor/${popupEditorBackups._id}`)
//         .set('Authorization', adminToken)
//         .expect(200);
//       expect(response.body).toEqual({
//         _id: expect.anything(),
//         __v: expect.anything(),
//         popupId: popupEditorBackups.popupId.toString(),
//         popupName: popupEditorBackups.popupName,
//         popupContent: popupEditorBackups.popupContent,
//       });
//     });
//   });
//   describe('updatePopupEditorBackup route', () => {
//     it('Should return 403 if user does not have permissions', async () => {
//       const response = await agent
//         .post('/api/backup/popupeditor/randomId334')
//         .send(reqBody)
//         .set('Authorization', volunteerToken)
//         .expect(403);
//       expect(response.body).toEqual({ error: 'You are not authorized to create new popup' });
//     });
//     it('Should return 400 if missing popupContent', async () => {
//       reqBody.popupContent = null;
//       const response = await agent
//         .post(`/api/backup/popupeditor/${reqBody.popupId}`)
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(400);
//
//       expect(response.body).toEqual({
//         error: 'popupContent is mandatory field',
//       });
//     });
//     it('Should return 201 if find and update the PopupEditorBackup successfully', async () => {
//       const _popupEditorBackups = new PopupEditorBackups();
//       _popupEditorBackups.popupId = reqBody.popupId;
//       _popupEditorBackups.popupName = reqBody.popupName;
//       _popupEditorBackups.popupContent = 'some content';
//       const popupEditorBackups = await _popupEditorBackups.save();
//       const response = await agent
//         .post(`/api/backup/popupeditor/${popupEditorBackups.popupId}`)
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(201);
//
//       expect(response.body).toEqual({
//         _id: expect.anything(),
//         __v: expect.anything(),
//         popupId: popupEditorBackups.popupId.toString(),
//         popupName: popupEditorBackups.popupName,
//         popupContent: reqBody.popupContent,
//       });
//     });
//     it('Should return 201 if the no find and create PopupEditorBackup successfully', async () => {
//       const response = await agent
//         .post(`/api/backup/popupeditor/${reqBody.popupId}`)
//         .send(reqBody)
//         .set('Authorization', adminToken)
//         .expect(201);
//       expect(response.body).toEqual({
//         _id: expect.anything(),
//         __v: expect.anything(),
//         popupId: reqBody.popupId.toString(),
//         popupName: reqBody.popupName,
//         popupContent: reqBody.popupContent,
//       });
//     });
//   });
// });
