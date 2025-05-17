const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const Project = require('../models/project');
const WBS = require('../models/wbs');
const Task = require('../models/task');
const {
  mockReq,
  createUser,
  createRole,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');

const agent = request.agent(app);

// TODO: Fix
describe('wbsRouter tests', () => {
  it("Fix this test suite", () => {})
});

// describe('actionItem routes', () => {
//   let adminUser;
//   let volunteerUser;
//   let adminToken;
//   let volunteerToken;
//   let project;
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
//
//     // create 2 roles. One with permission and one without
//     await createRole('Administrator', ['postWbs', 'deleteWbs']);
//     await createRole('Volunteer', []);
//
//     // create a project so we can create new wbs tasks
//     const _project = new Project();
//     _project.projectName = 'Test project';
//     _project.isActive = true;
//     _project.createdDatetime = new Date('2024-05-01');
//     _project.modifiedDatetime = new Date('2024-05-01');
//     _project.category = 'Food';
//
//     project = await _project.save();
//   });
//
//   beforeEach(async () => {
//     await dbClearCollections('wbs');
//     reqBody = {
//       ...reqBody,
//       wbsName: 'Sample WBS',
//       isActive: true,
//     };
//   });
//
//   afterAll(async () => {
//     await dbClearAll();
//     await dbDisconnect();
//   });
//
//   describe('wbsRouter tests', () => {
//     it('should return 401 if authorization header is not present', async () => {
//       await agent.get('/api/wbs/randomId').send(reqBody).expect(401);
//       await agent.post('/api/wbs/randomId').send(reqBody).expect(401);
//       await agent.delete('/api/wbs/randomId').send(reqBody).expect(401);
//       await agent.get('/api/wbsId/randomId').send(reqBody).expect(401);
//       await agent.get('/api/wbs/user/randomId').send(reqBody).expect(401);
//       await agent.get('/api/wbs').send(reqBody).expect(401);
//     });
//
//     it('should return 404 if the route does not exist', async () => {
//       await agent
//         .get('/api/wibs/randomId')
//         .set('Authorization', volunteerToken)
//         .send(reqBody)
//         .expect(404);
//       await agent
//         .post('/api/wibs/randomId')
//         .set('Authorization', volunteerToken)
//         .send(reqBody)
//         .expect(404);
//       await agent
//         .delete('/api/wibs/randomId')
//         .set('Authorization', volunteerToken)
//         .send(reqBody)
//         .expect(404);
//       await agent
//         .get('/api/wibsId/randomId')
//         .set('Authorization', volunteerToken)
//         .send(reqBody)
//         .expect(404);
//       await agent
//         .get('/api/wibs/user/randomId')
//         .set('Authorization', volunteerToken)
//         .send(reqBody)
//         .expect(404);
//       await agent.get('/api/wibs').set('Authorization', volunteerToken).send(reqBody).expect(404);
//     });
//
//     describe('getAllWBS routes', () => {
//       it("Should return 200 and an array of wbs' on success", async () => {
//         // now we create a wbs for the project
//         const _wbs = new WBS();
//
//         _wbs.wbsName = 'Sample WBS';
//         _wbs.projectId = project._id;
//         _wbs.isActive = true;
//         _wbs.createdDatetime = new Date('2024-05-01');
//         _wbs.modifiedDatetime = new Date('2024-05-01');
//
//         const wbs = await _wbs.save();
//
//         const response = await agent
//           .get(`/api/wbs/${project._id}`)
//           .set('Authorization', adminToken)
//           .send(reqBody)
//           .expect(200);
//
//         // Compare with the expected value
//         expect(response.body).toEqual([
//           {
//             _id: wbs._id.toString(),
//             modifiedDatetime: expect.anything(),
//             wbsName: wbs.wbsName,
//             isActive: wbs.isActive,
//           },
//         ]);
//       });
//     });
//
//     describe('postWBS route', () => {
//       it('Should return 403 if user does not have permission', async () => {
//         await agent
//           .post(`/api/wbs/randomId`)
//           .set('Authorization', volunteerToken)
//           .send(reqBody)
//           .expect(403);
//       });
//
//       it('Should return 400 if wbsName or isActive is missing from req body.', async () => {
//         reqBody.wbsName = null;
//         reqBody.isActive = null;
//
//         const res = await agent
//           .post(`/api/wbs/randomId`)
//           .set('Authorization', adminToken)
//           .send(reqBody)
//           .expect(400);
//
//         expect(res.body).toEqual({ error: 'WBS Name and active status are mandatory fields' });
//       });
//
//       it('Should create a new wbs and return 201 if all is successful', async () => {
//         const res = await agent
//           .post(`/api/wbs/${project._id}`)
//           .set('Authorization', adminToken)
//           .send(reqBody)
//           .expect(201);
//
//         expect(res.body).toEqual({
//           __v: expect.anything(),
//           _id: expect.anything(),
//           projectId: project._id.toString(),
//           wbsName: reqBody.wbsName,
//           isActive: reqBody.isActive,
//           createdDatetime: expect.anything(),
//           modifiedDatetime: expect.anything(),
//         });
//       });
//     });
//
//     describe('deleteWBS route', () => {
//       it('Should return 403 if user does not have permission', async () => {
//         await agent
//           .delete(`/api/wbs/randomId`)
//           .set('Authorization', volunteerToken)
//           .send(reqBody)
//           .expect(403);
//       });
//
//       it('Should return 400 if no record was found', async () => {
//         const res = await agent
//           .delete(`/api/wbs/randomId`)
//           .set('Authorization', adminToken)
//           .send(reqBody)
//           .expect(400);
//
//         expect(res.body).toEqual({ error: 'No valid records found' });
//       });
//
//       it('Should return 200 and delete the wbs on success', async () => {
//         // first lets create the wbs to delete.
//         const _wbs = new WBS();
//
//         _wbs.wbsName = 'Sample WBS';
//         _wbs.projectId = project._id;
//         _wbs.isActive = true;
//         _wbs.createdDatetime = new Date('2024-05-01');
//         _wbs.modifiedDatetime = new Date('2024-05-01');
//
//         const wbs = await _wbs.save();
//
//         const res = await agent
//           .delete(`/api/wbs/${wbs._id}`)
//           .set('Authorization', adminToken)
//           .send(reqBody)
//           .expect(200);
//
//         expect(res.body).toEqual({ message: ' WBS successfully deleted' });
//       });
//     });
//
//     describe('GetByID route', () => {
//       it('Should return 200 on success', async () => {
//         const _wbs = new WBS();
//
//         _wbs.wbsName = 'Sample WBS';
//         _wbs.projectId = project._id;
//         _wbs.isActive = true;
//         _wbs.createdDatetime = new Date('2024-05-01');
//         _wbs.modifiedDatetime = new Date('2024-05-01');
//
//         const wbs = await _wbs.save();
//
//         const res = await agent
//           .get(`/api/wbsId/${wbs._id}`)
//           .set('Authorization', adminToken)
//           .send(reqBody)
//           .expect(200);
//
//         expect(res.body).toEqual({
//           __v: expect.anything(),
//           _id: wbs._id.toString(),
//           wbsName: wbs.wbsName,
//           projectId: project._id.toString(),
//           isActive: wbs.isActive,
//           createdDatetime: expect.anything(),
//           modifiedDatetime: expect.anything(),
//         });
//       });
//     });
//
//     describe('getWBS route', () => {
//       it('Should return 200 and return all wbs', async () => {
//         const _wbs = new WBS();
//
//         _wbs.wbsName = 'Sample WBS';
//         _wbs.projectId = project._id;
//         _wbs.isActive = true;
//         _wbs.createdDatetime = new Date('2024-05-01');
//         _wbs.modifiedDatetime = new Date('2024-05-01');
//
//         const wbs = await _wbs.save();
//
//         const res = await agent
//           .get(`/api/wbs`)
//           .set('Authorization', adminToken)
//           .send(reqBody)
//           .expect(200);
//
//         expect(res.body).toEqual([
//           {
//             __v: expect.anything(),
//             _id: wbs._id.toString(),
//             wbsName: wbs.wbsName,
//             projectId: project._id.toString(),
//             isActive: wbs.isActive,
//             createdDatetime: expect.anything(),
//             modifiedDatetime: expect.anything(),
//           },
//         ]);
//       });
//     });
//
//     // TODO: Fix
//     // describe('Get wbs by user id route', () => {
//     //   it('Should return 200 and give the wbs related to user', async () => {
//     //     // create a wbs
//     //     const _wbs = new WBS();
//     //
//     //     _wbs.wbsName = 'Sample WBS';
//     //     _wbs.projectId = project._id;
//     //     _wbs.isActive = true;
//     //     _wbs.createdDatetime = new Date('2024-05-01');
//     //     _wbs.modifiedDatetime = new Date('2024-05-01');
//     //
//     //     const wbs = await _wbs.save();
//     //
//     //     // create a new task and link it to a user and wbs
//     //     const _task = new Task();
//     //
//     //     // Assign values to the task properties
//     //     _task.taskName = 'Sample Task';
//     //     _task.wbsId = wbs._id;
//     //     _task.num = '123';
//     //     _task.level = 1;
//     //     // Add resources
//     //     _task.resources.push({
//     //       name: 'John Doe',
//     //       userID: adminUser._id,
//     //       profilePic: 'https://example.com/profilepic.jpg',
//     //       completedTask: false,
//     //       reviewStatus: 'Unsubmitted',
//     //     });
//     //     // Set other properties
//     //     _task.isAssigned = true;
//     //     _task.status = 'Not Started';
//     //     _task.hoursBest = 0.0;
//     //     _task.hoursWorst = 0.0;
//     //     _task.hoursMost = 0.0;
//     //     _task.hoursLogged = 0.0;
//     //     _task.estimatedHours = 10.0;
//     //     _task.startedDatetime = new Date('2024-05-01');
//     //     _task.dueDatetime = new Date('2024-06-01');
//     //     _task.links = ['https://example.com/link1', 'https://example.com/link2'];
//     //     _task.relatedWorkLinks = ['https://example.com/related1', 'https://example.com/related2'];
//     //     _task.category = 'Sample Category';
//     //     _task.position = 1;
//     //     _task.isActive = true;
//     //     _task.hasChild = false;
//     //     _task.childrenQty = 0;
//     //     _task.createdDatetime = new Date();
//     //     _task.modifiedDatetime = new Date();
//     //     _task.whyInfo = 'Sample why info';
//     //     _task.intentInfo = 'Sample intent info';
//     //     _task.endstateInfo = 'Sample endstate info';
//     //     _task.classification = 'Sample classification';
//     //
//     //     // Save the task to the database
//     //     const task = await _task.save();
//     //
//     //     const res = await agent
//     //       .get(`/api/wbs/user/${adminUser._id}`)
//     //       .set('Authorization', adminToken)
//     //       .send(reqBody)
//     //       .expect(200);
//     //
//     //     expect(res.body).toEqual([
//     //       {
//     //         __v: expect.anything(),
//     //         _id: wbs._id.toString(),
//     //         createdDatetime: expect.anything(),
//     //         modifiedDatetime: expect.anything(),
//     //         isActive: task.isActive,
//     //         projectId: wbs.projectId.toString(),
//     //         wbsName: wbs.wbsName,
//     //       },
//     //     ]);
//     //   });
//     // });
//   });
// });
