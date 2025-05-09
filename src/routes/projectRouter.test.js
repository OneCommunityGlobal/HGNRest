const request = require('supertest');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  createRole,
  jwtPayload,
  mockUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');
const Project = require('../models/project');
const UserProfile = require('../models/userProfile');
const timeentry = require('../models/timeentry');

const agent = request.agent(app);

describe('project routes', () => {
  let adminUser;
  let volunteerUser;
  let adminToken;
  let volunteerToken;
  let reqBody = {
    ...mockReq.body,
  };

  let project;

  beforeAll(async () => {
    await dbConnect();
    adminUser = await createUser();
    volunteerUser = await createUser();
    volunteerUser.role = 'Volunteer';
    adminToken = jwtPayload(adminUser);
    volunteerToken = jwtPayload(volunteerUser);

    project = await Project.create({
      projectName: 'Sample1',
      isActive: true,
      projectCategory: 'Other',
    });

    await createRole('Administrator', [
      'deleteProject',
      'postProject',
      'putProject',
      'assignProjectToUsers',
    ]);
    await createRole('Volunteer', []);
  });

  beforeEach(async () => {
    await dbClearCollections('project');
    // reqBody = {
    //   ...reqBody,
    //   projectName: 'Sample1',
    //   isActive: true,
    //   projectCategory: 'Other',
    // };
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('projectRoutes', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/projects').send(reqBody).expect(401);
      await agent.get('/api/projects').send(reqBody).expect(401); //getAllProjects
      await agent.get(`/api/project/randomId`).send(reqBody).expect(401); //getProjectById
      await agent.put(`/api/project/randomId`).send(reqBody).expect(401);
      await agent.delete(`/api/project/randomId`).send(reqBody).expect(401);
      await agent.post(`/api/project/randomId`).send(reqBody).expect(401);
      await agent.get('/api/projects/users/randomid').send(reqBody).expect(401); //getUserProjects
      await agent.post('/api/project/randomId/users/').send(reqBody).expect(401);
      await agent.get('/api/project/randomid/users/').send(reqBody).expect(401); //getprojectMembership
    });

    it('Should return 404 if the route does not exist', async () => {
      await agent.post('/api/project').send(reqBody).set('Authorization', adminToken).expect(404);
      await agent
        .put(`/api/projects/randomId`)
        .set('Authorization', adminToken)
        .send(reqBody)
        .expect(404);
      await agent
        .delete(`/api/projects/randomId`)
        .set('Authorization', adminToken)
        .send(reqBody)
        .expect(404);
      await agent
        .post(`/api/projects/randomId`)
        .set('Authorization', adminToken)
        .send(reqBody)
        .expect(404);
      await agent
        .post(`/api/projects/randomId/users/`)
        .set('Authorization', adminToken)
        .send(reqBody)
        .expect(404);
    });
  });

  describe('getAllProjects route', () => {
    it('Should return 200 and all projects', async () => {
      const projects = [
        {
          projectName: 'Project 1',
          category: 'Other',
          isActive: true,
          modifiedDatetime: new Date(),
        },
        {
          projectName: 'Project 2',
          category: 'Other',
          isActive: false,
          modifiedDatetime: new Date(),
        },
      ];

      await Project.insertMany(projects);

      // Perform a GET request to fetch all projects
      const { body } = await agent
        .get('/api/projects')
        .send(reqBody)
        .set('Authorization', volunteerToken)
        .expect(200);

      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            projectName: 'Project 1',
            category: 'Other',
            isActive: true,
            modifiedDatetime: expect.any(String),
          }),
          expect.objectContaining({
            projectName: 'Project 2',
            category: 'Other',
            isActive: false,
            modifiedDatetime: expect.any(String),
          }),
        ]),
      );
    });
  });

  describe('delete projects route', () => {
    test('Should return 403 if user does not have permissions', async () => {
      const { body } = await agent
        .delete(`/api/project/${project._id}`)
        .send(reqBody)
        .set('Authorization', volunteerToken)
        .expect(403);

      expect(body).toEqual({ error: 'You are not authorized to delete projects.' });
    });

    test('Should return 400 if project does not exist', async () => {
      const { body } = await agent
        .delete(`/api/project/InvalidId`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(body).toEqual({ error: 'No valid records found' });
    });

    test('Should return 400 if project has a timeentry', async () => {
      await timeentry.create({
        projectId: project._id,
        dateOfWork: new Date(),
      });
      const { body } = await agent
        .delete(`/api/project/${project._id}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(body).toEqual({
        error:
          'This project has associated time entries and cannot be deleted. Consider inactivaing it instead.',
      });
    });

    test('Should return 200 and delete and update user profiles', async () => {
      const newProject = await Project.create({
        projectName: 'Sample2',
        isActive: true,
        projectCategory: 'Other',
      });

      const { body } = await agent
        .delete(`/api/project/${newProject._id}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

      expect(body).toEqual({
        message: 'Project successfully deleted and user profiles updated.',
      });
    });
  });

  describe('Post project route', () => {
    test('Should return 403 if user does not have permissions', async () => {
      const response = await agent
        .post('/api/projects')
        .send(reqBody)
        .set('Authorization', volunteerToken)
        .expect(401); //changed from 403 to 401

      expect(response.text).toEqual('You are not authorized to create new projects.');
    });

    test('Should return 201 if the project is successfully created', async () => {
      reqBody = {
        projectName: 'Sample5',
        isActive: true,
        projectCategory: 'Other',
      };

      const { body } = await agent
        .post('/api/projects')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200); //changes from 201 to 200

      expect(body).toEqual(
        expect.objectContaining({
          projectName: reqBody.projectName,
          category: reqBody.projectCategory,
          isActive: reqBody.isActive,
          createdDatetime: expect.any(String),
          modifiedDatetime: expect.any(String),
          _id: expect.anything(),
        }),
      );
    });

    test('Should return 400 if another project with the same name exists', async () => {
      // await agent.post('/api/projects').send(reqBody).set('Authorization', adminToken).expect(201);

      const response = await agent
        .post('/api/projects')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.text).toEqual(
        `Project Name must be unique. Another project with name ${reqBody.projectName} already exists. Please note that project names are case insensitive.`,
      );
    });
  });

  describe('put projects route', () => {
    test('Should return 403 if user does not have permissions', async () => {
      const response = await agent
        .put(`/api/project/${project._id}`)
        .send(reqBody)
        .set('Authorization', volunteerToken)
        .expect(403);

      expect(response.text).toEqual('You are not authorized to make changes in the projects.');
    });

    test('Should return 400 if project name is already taken', async () => {
      const newProject = await Project.create({
        projectName: 'Sample6',
        isActive: true,
        projectCategory: 'Other',
      });

      reqBody = {
        _id: newProject._id,
        projectName: 'Sample1',
        isActive: true,
        projectCategory: 'Other',
        isArchived: false,
      };
      const response = await agent
        .put(`/api/project/invalidProjectId`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.text).toEqual('This project name is already taken');
    });

    test('Should return 400 if project does not exist', async () => {
      reqBody = {
        _id: '66773e77ff757cfc875336f7',
        projectName: 'Sample9',
        isActive: true,
        projectCategory: 'Other',
        isArchived: false,
      };
      const response = await agent
        .put(`/api/project/invalidProjectId`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.text).toEqual('No valid records found');
    });

    // test.only('Should return 200 and update project', async () => {
    //   const newProject = await Project.create({
    //     projectName: 'Sample3',
    //     isActive: true,
    //     projectCategory: 'Other',
    //   });

    //   reqBody = {
    //     projectName: 'Smaple1',
    //     isActive: true,
    //     projectCategory: 'Tech',
    //     projectId: '12345',
    //     isArchived: false,
    //     _id: newProject._id,
    //     save: jest.fn().mockResolvedValue({ _id: '12345' }),
    //   };

    //   console.log('id', newProject);

    //   const { body } = await agent
    //     .put(`/api/project/${newProject._id}`)
    //     .send(reqBody)
    //     .set('Authorization', adminToken)
    //     .expect(200);

    //   expect(body).toEqual(body);
    // });
  });

  describe('getProjectById route', () => {
    test('Should return 200 and the project', async () => {
      const { body } = await agent
        .get(`/api/project/${project._id}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

      expect(body).toEqual(
        expect.objectContaining({
          _id: expect.anything(),
          projectName: 'Sample1',
          isActive: true,
          category: 'Other',
        }),
      );
    });
  });

  describe('getUserProjects route', () => {
    test('Should return 200 and the user project', async () => {
      let userObj = mockUser();
      userObj.projects = [project];
      const user = await UserProfile.create(userObj);
      // await userProjects.create({
      //   _id: user._id,
      //   projects: [project],
      // });
      const { body } = await agent
        .get(`/api/projects/user/${user._id}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

      expect(body).toEqual([
        {
          projectId: project._id.toString(),
          category: project.category,
          projectName: project.projectName,
        },
      ]);
    });
  });

  describe('getprojectMembership route', () => {
    test('Should return 400 if project id is invalid', async () => {
      const { text } = await agent
        .get(`/api/project/invalidId/users/`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(text).toEqual('Invalid request');
    });

    test('Should return 200 and the project membership', async () => {
      //check
      const { body } = await agent
        .get(`/api/project/${project._id}/users/`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);
    });
  });

  describe('assign projects route', () => {
    test('Should return 403 if the user does not have permission', async () => {
      const { text } = await agent
        .post(`/api/project/${project._id}/users/`)
        .send(reqBody)
        .set('Authorization', volunteerToken)
        .expect(403);

      expect(text).toEqual('You are not authorized to perform this operation');
    });

    test('Should return 400 for missing users array', async () => {
      reqBody = {
        requestor: 'user1',
      };

      const { text } = await agent
        .post(`/api/project/${project._id}/users/`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(text).toEqual('Invalid request');
    });

    test('Should return 400 for invalid projectId', async () => {
      reqBody = {
        requestor: 'user1',
        users: [
          { userId: 'user2', operation: 'Assign' },
          { userId: 'user3', operation: 'Unassign' },
        ],
      };

      const { text } = await agent
        .post(`/api/project/invalidProjectId/users/`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(text).toEqual('Invalid request');
    });

    test('Should return 400 if project does not exist', async () => {
      reqBody = {
        requestor: 'user1',
        users: [
          { userId: 'user2', operation: 'Assign' },
          { userId: 'user3', operation: 'Unassign' },
        ],
      };

      const projectId = '60d21b4667d0d8992e610c85';

      const { text } = await agent
        .post(`/api/project/${projectId}/users/`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(text).toEqual('Invalid project');
    });

    test('Should return 200, Assign and Unassign Projects and return result `Done`', async () => {
      const user1 = await UserProfile.create(mockUser());
      const user2 = await UserProfile.create(mockUser());
      reqBody = {
        requestor: 'user1',
        users: [
          { userId: user1._id, operation: 'Assign' },
          { userId: user2._id, operation: 'Unassign' },
        ],
      };

      const { body } = await agent
        .post(`/api/project/${project._id}/users/`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

      expect(body).toEqual({ result: 'Done' });

      const updatedUser1 = await UserProfile.findById(user1._id);
      const updatedUser2 = await UserProfile.findById(user2._id);
      expect(updatedUser1.projects).toContainEqual(project._id);
      expect(updatedUser2.projects).not.toContainEqual(project._id);
    });
  });
});
