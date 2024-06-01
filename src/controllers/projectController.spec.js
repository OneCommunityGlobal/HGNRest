const mongoose = require('mongoose');

const {
  mockReq,
  mockRes,
  mongoHelper: { dbConnect, dbDisconnect },
  assertResMock,
} = require('../test');

const Project = require('../models/project');
const timeentry = require('../models/timeentry');
const userProfile = require('../models/userProfile');
const helper = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
const userProject = require('../helpers/helperModels/userProjects');

const projectController = require('./projectController');

// mock the cache function before importing so we can manipulate the implementation
jest.mock('../utilities/nodeCache');
// const cache = require('../utilities/nodeCache');

const makeSut = () => {
  const {
    getAllProjects,
    deleteProject,
    postProject,
    assignProjectToUsers,
    putProject,
    getProjectById,
    getUserProjects,
    getprojectMembership,
  } = projectController(Project);

  return {
    getAllProjects,
    deleteProject,
    postProject,
    assignProjectToUsers,
    putProject,
    getProjectById,
    getUserProjects,
    getprojectMembership,
  };
};

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

const flushPromises = () => new Promise(setImmediate);

describe('projectController module', () => {
  beforeAll(async () => {
    await dbConnect();
  });

  beforeEach(() => {
    mockReq.body.role = 'any_role';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await dbDisconnect();
    // Clear models after disconnecting
    mongoose.models = {};
    mongoose.modelSchemas = {};
  });

  describe('getAllProjects function', () => {
    test('Ensure getAllProjects returns 404 if there is an error accessing the database', async () => {
      const { getAllProjects } = makeSut();
      const dbError = new Error('Database connection error');
      jest.spyOn(Project, 'find').mockImplementation(() => ({
        sort: () => ({
          then: jest.fn().mockRejectedValue(dbError),
        }),
      }));

      const response = await getAllProjects(mockReq, mockRes);
      assertResMock(404, dbError, response, mockRes);
    });

    test('Ensure getAllProjects returns 200 and retrieves all projects sorted by modifiedDatetime in descending order', async () => {
      const mockProjects = [
        { projectName: 'Project A', modifiedDatetime: new Date(2020, 1, 1) },
        { projectName: 'Project B', modifiedDatetime: new Date(2020, 0, 1) },
      ];
      const { getAllProjects } = makeSut();

      const mockSort = jest.fn().mockResolvedValue(mockProjects);
      jest.spyOn(Project, 'find').mockReturnValue({ sort: mockSort });

      const response = await getAllProjects(mockReq, mockRes);
      assertResMock(200, mockProjects, response, mockRes);
      expect(Project.find().sort).toHaveBeenCalledWith({ modifiedDatetime: -1 });
    });

    test('returns 200 if database contains no projects', async () => {
      const { getAllProjects } = makeSut();

      jest.spyOn(Project, 'find').mockImplementation(() => ({
        sort: jest.fn().mockResolvedValue([]),
      }));

      const response = await getAllProjects(mockReq, mockRes);

      assertResMock(200, [], response, mockRes);
    });
  });

  describe('deleteProject function', () => {
    test('Ensure deleteProject returns 403 if the user does not have deleteProject permissions', async () => {
      const { deleteProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(false);

      const response = await deleteProject(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'deleteProject');
      assertResMock(
        403,
        {
          error: 'You are not authorized to delete projects.',
        },
        response,
        mockRes,
      );
    });

    test('Ensure deleteProject returns 400 if an error occurs in `findById`', async () => {
      const { deleteProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const errMsg = 'Error occured when finding project by ID';
      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };
      // jest.spyOn(Project, 'findById').mockImplementationOnce(() => ({
      //   exec: jest.fn().mockRejectedValueOnce(new Error(errMsg)),
      // }));
      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(new Error(errMsg), null);
      });

      const response = await deleteProject(mockReqModified, mockRes);

      assertResMock(400, { error: 'No valid records found' }, response, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'deleteProject',
      );
    });

    test('Ensure deleteProject returns 400 if the project ID provided does not correspond to any project in the database', async () => {
      const { deleteProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };

      // jest.spyOn(Project, 'findById').mockResolvedValue(null);
      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(null, null);
      });

      const response = await deleteProject(mockReqModified, mockRes);

      await flushPromises();

      assertResMock(400, { error: 'No valid records found' }, response, mockRes);

      // expect(mockRes.status).toHaveBeenCalledWith(400);
      // expect(mockRes.send).toHaveBeenCalledWith({ error: 'No valid records found' });
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'deleteProject',
      );
    });

    test('Ensure deleteProject returns 400 if the findById return an empty array', async () => {
      const { deleteProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };

      // jest.spyOn(Project, 'findById').mockResolvedValue(null);
      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(null, []);
      });

      const response = await deleteProject(mockReqModified, mockRes);

      await flushPromises();

      assertResMock(400, { error: 'No valid records found' }, response, mockRes);

      // expect(mockRes.status).toHaveBeenCalledWith(400);
      // expect(mockRes.send).toHaveBeenCalledWith({ error: 'No valid records found' });
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'deleteProject',
      );
    });

    test('Ensure deleteProject returns 400 if an error occurs in finding timeenrties', async () => {
      const { deleteProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };
      const fakeRecord = {
        _id: '12345',
        remove: jest.fn(),
      };

      const errMsg = 'Error occured when finding timeentry by projectID';
      // const findByIdSpy = jest.spyOn(Project, 'findById').mockReturnValue({
      //   exec: jest.fn().mockResolvedValue({
      //     _id: '60d5f8f9f7c9b9a23e8d1f99',
      //     remove: jest.fn(),
      //   }),
      // });

      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(null, fakeRecord);
      });

      // const findTimeEntriesSpy = jest.spyOn(timeentry, 'find').mockReturnValue({
      //   exec: jest.fn().mockRejectedValueOnce(new Error(errMsg)),
      // });

      const findTimeEntriesSpy = jest
        .spyOn(timeentry, 'find')
        .mockRejectedValueOnce(new Error(errMsg));

      const response = await deleteProject(mockReqModified, mockRes);
      await flushPromises();

      assertResMock(400, new Error(errMsg), response, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'deleteProject',
      );
      expect(findTimeEntriesSpy).toHaveBeenCalledWith(
        { projectId: mockReqModified.params.projectId },
        '_id',
      );
    });

    test('Ensure deleteProject returns 400 if the project has one or more associated time entries', async () => {
      const { deleteProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };
      const fakeRecord = {
        _id: '12345',
        remove: jest.fn(),
      };

      // const findByIdSpy = jest.spyOn(Project, 'findById').mockReturnValue({
      //   exec: jest.fn().mockResolvedValue({
      //     _id: '60d5f8f9f7c9b9a23e8d1f99',
      //     remove: jest.fn(), // Ensure this method is mocked if using deleteOne
      //   }),
      // });

      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(null, fakeRecord);
      });

      // const findTimeEntriesSpy = jest.spyOn(timeentry, 'find').mockReturnValue({
      //   exec: jest.fn().mockResolvedValueOnce([{ _id: 'timeentry-id' }]),
      // });

      const findTimeEntriesSpy = jest
        .spyOn(timeentry, 'find')
        .mockResolvedValueOnce([{ _id: 'timeentry-id' }]);

      const response = await deleteProject(mockReqModified, mockRes);

      assertResMock(
        400,
        {
          error:
            'This project has associated time entries and cannot be deleted. Consider inactivaing it instead.',
        },
        response,
        mockRes,
      );

      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'deleteProject',
      );
      expect(findTimeEntriesSpy).toHaveBeenCalledWith(
        { projectId: mockReqModified.params.projectId },
        '_id',
      );
    });

    test('Ensure deleteProject returns 400 userProfile updateMany fails', async () => {
      const { deleteProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };
      const fakeRecord = {
        _id: '12345',
        remove: jest.fn().mockResolvedValue(true),
      };

      const errMsg = 'Failed to update user profiles';

      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(null, fakeRecord);
      });

      const findTimeEntriesSpy = jest.spyOn(timeentry, 'find').mockResolvedValueOnce([]);

      // jest.spyOn(userProfile, 'updateMany').mockRejectedValue(new Error(errMsg));

      jest.spyOn(userProfile, 'updateMany').mockImplementation(() => ({
        exec: jest.fn().mockRejectedValue(new Error(errMsg)),
      }));

      const response = await deleteProject(mockReqModified, mockRes);
      await flushPromises();

      assertResMock(400, new Error(errMsg), response, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'deleteProject',
      );
      expect(findTimeEntriesSpy).toHaveBeenCalledWith(
        { projectId: mockReqModified.params.projectId },
        '_id',
      );
    });

    test('Ensure deleteProject returns 400 if record.remove() fails', async () => {
      const { deleteProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };

      const errMsg = 'Failed to remove project';
      const fakeRecord = {
        _id: '12345',
        remove: jest.fn().mockRejectedValue(new Error(errMsg)),
      };

      // jest.spyOn(Project, 'findById').mockReturnValue({
      //   exec: jest.fn().mockResolvedValue(fakeRecord),
      // });

      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(null, fakeRecord);
      });

      const findTimeEntriesSpy = jest.spyOn(timeentry, 'find').mockResolvedValueOnce([]);

      // Mock updateMany to simulate a failure
      jest.spyOn(userProfile, 'updateMany').mockImplementation(() => ({
        exec: jest.fn().mockResolvedValueOnce(true),
      }));

      const response = await deleteProject(mockReqModified, mockRes);
      await flushPromises();

      assertResMock(400, new Error(errMsg), response, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'deleteProject',
      );
      expect(findTimeEntriesSpy).toHaveBeenCalledWith(
        { projectId: mockReqModified.params.projectId },
        '_id',
      );
    });

    test('Ensure deleteProject returns 200 and should successfully delete the project if record.remove() succeeds', async () => {
      const { deleteProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };

      const fakeRecord = {
        _id: '12345',
        remove: jest.fn().mockResolvedValue(),
      };

      // jest.spyOn(Project, 'findById').mockReturnValue({
      //   exec: jest.fn().mockResolvedValue(fakeRecord),
      // });

      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(null, fakeRecord);
      });

      const findTimeEntriesSpy = jest.spyOn(timeentry, 'find').mockResolvedValueOnce([]);

      jest.spyOn(userProfile, 'updateMany').mockImplementation(() => ({
        exec: jest.fn().mockResolvedValueOnce(),
      }));

      const response = await deleteProject(mockReqModified, mockRes);
      await flushPromises();

      assertResMock(
        200,
        {
          message: 'Project successfully deleted and user profiles updated.',
        },
        response,
        mockRes,
      );
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'deleteProject',
      );
      expect(findTimeEntriesSpy).toHaveBeenCalledWith(
        { projectId: mockReqModified.params.projectId },
        '_id',
      );
    });
  });

  describe('postProject function', () => {
    test('Ensure postProject returns 403 if the user does not have postProject permissions', async () => {
      const { postProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(false);

      const response = await postProject(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postProject');
      assertResMock(
        403,
        {
          error: 'You are not authorized to create new projects.',
        },
        response,
        mockRes,
      );
    });

    test('Ensure postProject returns 400 if the status is empty', async () => {
      const { postProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            projectName: 'Smaple',
            // isActive: true,
          },
        },
      };

      const mockNext = jest.fn();

      await postProject(mockReqModified, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Project Name and active status are mandatory fields.',
      });
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postProject');
    });

    test('Ensure postProject returns 400 if the project name is empty', async () => {
      const { postProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            // projectName: 'Smaple',
            isActive: true,
          },
        },
      };

      const mockNext = jest.fn();

      await postProject(mockReqModified, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Project Name and active status are mandatory fields.',
      });
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postProject');
    });

    test('Ensure postProject returns 500 if any error occurs when finding a project', async () => {
      const { postProject } = makeSut();
      const errorMsg = 'Error when finding project';
      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            projectName: 'Smaple',
            isActive: true,
          },
        },
      };

      const findSpy = jest
        .spyOn(Project, 'find')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));

      const response = await postProject(mockReqModified, mockRes);
      await flushPromises();

      assertResMock(500, { error: new Error(errorMsg) }, response, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postProject');
      expect(findSpy).toHaveBeenCalledWith({
        projectName: { $regex: escapeRegex(mockReqModified.body.projectName), $options: 'i' },
      });
    });

    test('Ensure postProject returns 400 if the projectName exists', async () => {
      const { postProject } = makeSut();
      const hasPermissionSpy = mockHasPermission(true);
      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            projectName: 'Sample',
            isActive: true,
          },
        },
      };
      const result = [{ projectName: 'Sample' }];

      const findSpy = jest
        .spyOn(Project, 'find')
        .mockImplementationOnce(() => Promise.resolve(result));

      const response = await postProject(mockReqModified, mockRes);
      await flushPromises();

      expect(findSpy).toHaveBeenCalledWith({
        projectName: { $regex: escapeRegex(mockReqModified.body.projectName), $options: 'i' },
      });

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postProject');

      assertResMock(
        400,
        {
          error: `Project Name must be unique. Another project with name ${mockReqModified.body.projectName} already exists. Please note that project names are case insensitive.`,
        },
        response,
        mockRes,
      );
    });

    test('Ensure postProject returns 500 any error occurs in saving project', async () => {
      const { postProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const errorMsg = 'Error when saving project';

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            projectName: 'Smaple',
            isActive: true,
          },
        },
      };

      const findSpy = jest.spyOn(Project, 'find').mockImplementationOnce(() => Promise.resolve([]));

      jest
        .spyOn(Project.prototype, 'save')
        .mockImplementationOnce(() => Promise.reject(new Error(errorMsg)));

      const response = await postProject(mockReqModified, mockRes);
      await flushPromises();

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postProject');

      assertResMock(500, { error: new Error(errorMsg) }, response, mockRes);
      expect(findSpy).toHaveBeenCalledWith({
        projectName: { $regex: escapeRegex(mockReqModified.body.projectName), $options: 'i' },
      });
    });

    test('Ensure postProject returns 201 and should successfully create a project if the project name does not exist', async () => {
      const { postProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            projectName: 'Smaple1',
            isActive: true,
            projectCategory: 'Tech',
          },
        },
      };
      const findSpy = jest.spyOn(Project, 'find').mockImplementationOnce(() => Promise.resolve([]));

      const newProject = {
        projectName: mockReq.body.projectName,
        category: mockReq.body.projectCategory,
        isActive: mockReq.body.isActive,
        createdDatetime: new Date(),
        modifiedDatetime: new Date(),
      };

      jest.spyOn(Project.prototype, 'save').mockImplementation(() => Promise.resolve(newProject));

      const response = await postProject(mockReqModified, mockRes);
      await flushPromises();

      assertResMock(201, newProject, response, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postProject');
      expect(findSpy).toHaveBeenCalledWith({
        projectName: { $regex: escapeRegex(mockReqModified.body.projectName), $options: 'i' },
      });
    });
  });

  describe('assignProjectToUsers function', () => {
    test('Ensure assignProjectToUsers returns 403 if the user does not have assignProjectToUsers permissions', async () => {
      const { assignProjectToUsers } = makeSut();

      const hasPermissionSpy = mockHasPermission(false);

      const response = await assignProjectToUsers(mockReq, mockRes);

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'assignProjectToUsers');
      assertResMock(
        403,
        {
          error: 'You are not authorized to perform this operation',
        },
        response,
        mockRes,
      );
    });

    test('Ensure assignProjectToUsers returns 400 if the projectId or users is empty', async () => {
      const { assignProjectToUsers } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            requestor: 'user1',
            users: [],
          },
        },
        params: {
          ...mockReq.params,
          projectId: '', // Invalid projectId
        },
      };

      await assignProjectToUsers(mockReqModified, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Invalid request',
      });
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'assignProjectToUsers',
      );
    });

    test('Ensure assignProjectToUsers returns 400 if the project ID provided does not correspond to any project in the database', async () => {
      const { assignProjectToUsers } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);
      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            requestor: 'user1',
            users: ['user2'], // Non-empty array
          },
        },
        params: {
          ...mockReq.params,
          projectId: '60d21b4667d0d8992e610c85', // Valid ObjectId
        },
      };

      // const mockReq = {
      //   body: {
      //     requestor: 'user1',
      //     users: ['user2'], // Non-empty array
      //   },
      //   params: {
      //     projectId: '60d21b4667d0d8992e610c85', // Valid ObjectId
      //   },
      // };

      jest.spyOn(Project, 'findById').mockResolvedValue([]);

      await assignProjectToUsers(mockReqModified, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Invalid project' });
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'assignProjectToUsers',
      );
    });

    test('Ensure assignProjectToUsers returns 400 if the project does not exist', async () => {
      const { assignProjectToUsers } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            requestor: 'user1',
            users: [{ userId: 'user2', operation: 'Assign' }],
          },
        },
        params: {
          ...mockReq.params,
          projectId: '123456789012',
        },
      };

      jest.spyOn(Project, 'findById').mockResolvedValue(null);

      await assignProjectToUsers(mockReqModified, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Invalid project',
      });
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'assignProjectToUsers',
      );
    });

    test('Ensure assignProjectToUsers returns 400 if the project list is empty', async () => {
      const { assignProjectToUsers } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            requestor: 'user1',
            users: [{ userId: 'user2', operation: 'Assign' }],
          },
        },
        params: {
          ...mockReq.params,
          projectId: '123456789012',
        },
      };

      jest.spyOn(Project, 'findById').mockResolvedValue([]);

      await assignProjectToUsers(mockReqModified, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);

      expect(mockRes.send).toHaveBeenCalledWith({
        error: 'Invalid project',
      });
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'assignProjectToUsers',
      );
    });

    test('Ensure assignProjectToUsers returns 500 if an error occurs in findById', async () => {
      const { assignProjectToUsers } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            requestor: 'user1',
            users: [{ userId: 'user2', operation: 'Assign' }],
          },
        },
        params: {
          ...mockReq.params,
          projectId: '123456789012',
        },
      };

      const errorMessage = 'Error finding project';

      jest.spyOn(Project, 'findById').mockRejectedValue(new Error(errorMessage));

      assignProjectToUsers(mockReqModified, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: new Error(errorMessage) });
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'assignProjectToUsers',
      );
    });

    test('Ensure assignProjectToUsers returns 500 if an error occurs when assign and unassigns users correctly', async () => {
      const { assignProjectToUsers } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const errorMsg = 'Error in updating user profiles';

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            requestor: 'user1',
            users: [
              { userId: 'user2', operation: 'Assign' },
              { userId: 'user3', operation: 'Unassign' },
            ],
          },
        },
        params: {
          ...mockReq.params,
          projectId: '60d21b4667d0d8992e610c85',
        },
      };

      const mockProject = { _id: '60d21b4667d0d8992e610c85' };

      jest.spyOn(Project, 'findById').mockResolvedValue(mockProject);

      const assignExecMock = jest.fn().mockRejectedValue(new Error(errorMsg));
      const unassignExecMock = jest.fn().mockRejectedValue(new Error(errorMsg));

      const assignSpy = jest.spyOn(userProfile, 'updateMany').mockImplementation(() => ({
        exec: assignExecMock,
      }));
      const unassignSpy = jest.spyOn(userProfile, 'updateMany').mockImplementation(() => ({
        exec: unassignExecMock,
      }));

      assignProjectToUsers(mockReqModified, mockRes);
      await flushPromises();

      expect(assignSpy).toHaveBeenCalledWith(
        { _id: { $in: ['user2'] } },
        { $addToSet: { projects: mockProject._id } },
      );
      // Ensure users are correctly unassigned
      expect(unassignSpy).toHaveBeenCalledWith(
        { _id: { $in: ['user3'] } },
        { $pull: { projects: mockProject._id } },
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: new Error(errorMsg) });
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'assignProjectToUsers',
      );
    });

    test('Ensure assignProjectToUsers returns 200 when assigns and unassigns users correctly', async () => {
      const { assignProjectToUsers } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            requestor: 'user1',
            users: [
              { userId: 'user2', operation: 'Assign' },
              { userId: 'user3', operation: 'Unassign' },
            ],
          },
        },
        params: {
          ...mockReq.params,
          projectId: '60d21b4667d0d8992e610c85',
        },
      };

      const mockProject = { _id: '60d21b4667d0d8992e610c85' };

      jest.spyOn(Project, 'findById').mockResolvedValue(mockProject);

      const assignExecMock = jest.fn().mockResolvedValue({});
      const unassignExecMock = jest.fn().mockResolvedValue({});

      const assignSpy = jest.spyOn(userProfile, 'updateMany').mockImplementation(() => ({
        exec: assignExecMock,
      }));
      const unassignSpy = jest.spyOn(userProfile, 'updateMany').mockImplementation(() => ({
        exec: unassignExecMock,
      }));

      assignProjectToUsers(mockReqModified, mockRes);
      await flushPromises();

      expect(assignSpy).toHaveBeenCalledWith(
        { _id: { $in: ['user2'] } },
        { $addToSet: { projects: mockProject._id } },
      );
      // Ensure users are correctly unassigned
      expect(unassignSpy).toHaveBeenCalledWith(
        { _id: { $in: ['user3'] } },
        { $pull: { projects: mockProject._id } },
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({ result: 'Done' });
      expect(hasPermissionSpy).toHaveBeenCalledWith(
        mockReqModified.body.requestor,
        'assignProjectToUsers',
      );
    });
  });

  describe('putProject function', () => {
    test('Ensure putProject returns 403 if the user does not have putProject permissions', async () => {
      const { putProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(false);

      const response = await putProject(mockReq, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'putProject');
      assertResMock(
        403,
        'You are not authorized to make changes in the projects.',
        response,
        mockRes,
      );
    });

    test('Ensure putProject returns 400 if an error occurs in `findById`', async () => {
      const { putProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const errMsg = 'Error occured when finding project by ID';
      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(new Error(errMsg));
      });

      const response = await putProject(mockReq, mockRes);

      assertResMock(400, 'No valid records found', response, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'putProject');
    });

    test('Ensure putProject returns 400 if the project ID provided does not correspond to any project in the database', async () => {
      const { putProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(null, null);
      });

      const response = await putProject(mockReq, mockRes);

      assertResMock(400, 'No valid records found', response, mockRes);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'putProject');
    });

    test('Ensure putProject returns 500 status if an error occurs in saving', async () => {
      const { putProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const errorMsg = 'Error when saving project';

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            projectName: 'Smaple1',
            isActive: true,
            projectCategory: 'Tech',
          },
        },
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };

      const fakeRecord = {
        _id: '12345',
        projectName: 'New Project Name',
        category: 'New Category',
        isActive: true,
        modifiedDatetime: null,
        save: jest.fn().mockRejectedValue(new Error(errorMsg)),
      };

      // const projectId = mockReqModified.params.projectId;

      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(null, fakeRecord);
      });

      jest.spyOn(Project.prototype, 'save').mockImplementation(() => Promise.reject(fakeRecord));

      putProject(mockReqModified, mockRes);
      await flushPromises();

      // assertResMock(400, new Error(errorMsg), response, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(new Error(errorMsg));

      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReqModified.body.requestor, 'putProject');
    });

    test('Ensure putProject returns 201 status and return the record ID on successful save', async () => {
      const { putProject } = makeSut();

      const hasPermissionSpy = mockHasPermission(true);

      const mockReqModified = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...{
            projectName: 'Smaple1',
            isActive: true,
            projectCategory: 'Tech',
          },
        },
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };

      const fakeRecord = {
        _id: '12345',
        projectName: 'New Project Name',
        category: 'New Category',
        isActive: true,
        modifiedDatetime: null,
        save: jest.fn().mockResolvedValue({ _id: '12345' }),
      };

      // const projectId = mockReqModified.params.projectId;

      jest.spyOn(Project, 'findById').mockImplementation((projectId, callback) => {
        callback(null, fakeRecord);
      });

      jest.spyOn(Project.prototype, 'save').mockImplementation(() => Promise.resolve(fakeRecord));

      putProject(mockReqModified, mockRes);
      await flushPromises();

      // assertResMock(201, fakeRecord._id, response, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.send).toHaveBeenCalledWith(fakeRecord._id);
      expect(hasPermissionSpy).toHaveBeenCalledWith(mockReqModified.body.requestor, 'putProject');
    });
  });

  describe('getProjectById function', () => {
    test('Ensure getProjectById returns 404 status and the error object when findById fails', async () => {
      const { getProjectById } = makeSut();
      const errorMessage = 'Error finding project';
      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };

      const { projectId } = mockReqModified.params;

      const mockFindById = jest
        .spyOn(Project, 'findById')
        .mockRejectedValueOnce(new Error(errorMessage));

      getProjectById(mockReqModified, mockRes);

      await flushPromises();

      expect(mockFindById).toHaveBeenCalledWith(
        projectId,
        '-__v  -createdDatetime -modifiedDatetime',
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(expect.objectContaining({ message: errorMessage }));
    });

    test('Ensure getProjectById returns send a 200 status and the project data when findById is successful', async () => {
      const { getProjectById } = makeSut();
      const projectData = { name: 'Project X', id: '123' };
      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };

      const { projectId } = mockReqModified.params;

      const mockFindById = jest.spyOn(Project, 'findById').mockResolvedValueOnce(projectData);

      getProjectById(mockReqModified, mockRes);

      await flushPromises();

      expect(mockFindById).toHaveBeenCalledWith(
        projectId,
        '-__v  -createdDatetime -modifiedDatetime',
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(projectData);
    });
  });

  describe('getUserProjects function', () => {
    test('Ensure getUserProjects returns a 400 status and the error object when findById fails', async () => {
      const { getUserProjects } = makeSut();

      const errorMessage = 'Error finding projects';
      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };

      jest.spyOn(userProject, 'findById').mockRejectedValue(new Error(errorMessage));

      getUserProjects(mockReqModified, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(expect.objectContaining({ message: errorMessage }));
    });

    test('Ensure getUserProjects returns send a 200 status and the userProject data when findById is successful', async () => {
      const { getUserProjects } = makeSut();

      const projectData = { projects: [{ projectName: 'Project X', projectId: '123' }] };
      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: '12345',
        },
      };

      jest.spyOn(userProject, 'findById').mockResolvedValueOnce(projectData);

      getUserProjects(mockReqModified, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(projectData.projects);
    });
  });

  describe('getprojectMembership function', () => {
    test('Ensure getprojectMembership returns a 400 status if the projectID is Invalid ', async () => {
      const { getprojectMembership } = makeSut();

      const mockReqModified = {
        ...mockReq,
        params: {
          ...mockReq.params,
          projectId: 'invalid-id',
        },
      };

      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(false);
      await getprojectMembership(mockReqModified, mockRes);
      // await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid request' }),
      );
    });

    test('Ensure getprojectMembership returns 200 and project membership', async () => {
      const { getprojectMembership } = makeSut();

      const mockProjects = [{ firstName: 'abc', lastName: 'def' }];

      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);

      const mockSort = jest.fn().mockResolvedValue(mockProjects);
      jest.spyOn(userProfile, 'find').mockReturnValue({ sort: mockSort });

      await getprojectMembership(mockReq, mockRes);
      // await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockProjects);
      expect(mockSort).toHaveBeenCalledWith({ firstName: 1, lastName: 1 });
    });

    test('Ensure getprojectMembership returns 500 if error occurs', async () => {
      const { getprojectMembership } = makeSut();

      const errorMessage = 'Error finding project';

      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);

      // const mockSort = jest.fn().mockResolvedValue(new Error(errorMessage));
      jest.spyOn(userProfile, 'find').mockImplementation(() => ({
        sort: jest.fn().mockRejectedValueOnce(new Error(errorMessage)),
      }));

      getprojectMembership(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(new Error(errorMessage));
    });
  });
});
