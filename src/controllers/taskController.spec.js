const mongoose = require('mongoose');

// Utility to aid in testing
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('../utilities/emailSender', () => jest.fn());

const taskHelperMethods = {
  getTasksForTeams: jest.fn(),
  getTasksForSingleUser: jest.fn(),
};
jest.mock('../helpers/taskHelper', () => () => ({ ...taskHelperMethods }));

const flushPromises = () => new Promise(setImmediate);
const { mockReq, mockRes, assertResMock } = require('../test');
const { hasPermission } = require('../utilities/permissions');
const emailSender = require('../utilities/emailSender');

// controller to test
const taskController = require('./taskController');

// MongoDB Model imports
const Task = require('../models/task');
const Project = require('../models/project');
const UserProfile = require('../models/userProfile');
const WBS = require('../models/wbs');
const FollowUp = require('../models/followUp');

const makeSut = () => {
  const {
    getTasks,
    getWBSId,
    importTask,
    postTask,
    updateNum,
    moveTask,
    deleteTask,
    deleteTaskByWBS,
    updateTask,
    swap,
    getTaskById,
    fixTasks,
    updateAllParents,
    getTasksByUserId,
    sendReviewReq,
    getTasksForTeamsByUser,
    updateTaskStatus,
  } = taskController(Task);

  return {
    getTasks,
    getWBSId,
    importTask,
    postTask,
    updateNum,
    moveTask,
    deleteTask,
    deleteTaskByWBS,
    updateTask,
    swap,
    getTaskById,
    fixTasks,
    updateAllParents,
    getTasksByUserId,
    sendReviewReq,
    getTasksForTeamsByUser,
    updateTaskStatus,
  };
};

describe('Unit Tests for taskController.js', () => {
  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('getTasks function', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Returns 200 on successfully querying the document', async () => {
      const { getTasks } = makeSut();
      const mockData = 'some random data';

      const taskFindSpy = jest.spyOn(Task, 'find').mockResolvedValueOnce(mockData);

      const response = await getTasks(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, mockData, response, mockRes);
      expect(taskFindSpy).toHaveBeenCalled();
      expect(taskFindSpy).toHaveBeenCalledTimes(1);
    });

    test('Returns 200 on successfully querying the document', async () => {
      const { getTasks } = makeSut();
      const error = 'some random error';

      const taskFindSpy = jest.spyOn(Task, 'find').mockRejectedValueOnce(error);

      const response = await getTasks(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, error, response, mockRes);
      expect(taskFindSpy).toHaveBeenCalled();
      expect(taskFindSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getWBSId function', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Returns 200 on successfully querying the document', async () => {
      const { getWBSId } = makeSut();
      const mockData = 'some random data';

      const wbsFindByIdSpy = jest.spyOn(WBS, 'findById').mockResolvedValueOnce(mockData);

      const response = await getWBSId(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, mockData, response, mockRes);
      expect(wbsFindByIdSpy).toHaveBeenCalled();
      expect(wbsFindByIdSpy).toHaveBeenCalledTimes(1);
    });

    test('Returns 200 on successfully querying the document', async () => {
      const { getWBSId } = makeSut();
      const error = 'some random error';

      const wbsFindByIdSpy = jest.spyOn(WBS, 'findById').mockRejectedValueOnce(error);

      const response = await getWBSId(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, error, response, mockRes);
      expect(wbsFindByIdSpy).toHaveBeenCalled();
      expect(wbsFindByIdSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('importTasks function()', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Return 403 if `importTask` permission is missing', async () => {
      const { importTask } = makeSut();
      hasPermission.mockResolvedValueOnce(false);

      const error = { error: 'You are not authorized to create new Task.' };

      const response = await importTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
    });

    test('Return 201 on successful import operation', async () => {
      const { importTask } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.params.wbs = 'wbs123';
      mockReq.body.list = [
        {
          _id: 'mongoDB-Id',
          num: '1',
          level: 1,
          parentId1: null,
          parentId2: null,
          parentId3: null,
          mother: null,
          resources: ['parth|userId123|parthProfilePic', 'test|test123|testProfilePic'],
        },
      ];

      const saveMock = jest
        .fn()
        .mockImplementation(() => Promise.resolve({ _id: '1', wbsId: 'wbs123' }));
      const TaskConstructorSpy = jest.spyOn(Task.prototype, 'save').mockImplementation(saveMock);

      const data = 'done';

      const response = await importTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(201, data, response, mockRes);
      expect(TaskConstructorSpy).toBeCalled();
    });

    test('Return 400 on encountering any error while saving task', async () => {
      const { importTask } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.params.wbs = 'wbs123';
      mockReq.body.list = [
        {
          _id: 'mongoDB-Id',
          num: '1',
          level: 1,
          parentId1: null,
          parentId2: null,
          parentId3: null,
          mother: null,
          resources: ['parth|userId123|parthProfilePic', 'test|test123|testProfilePic'],
        },
      ];

      const error = new Error('error while saving');

      const saveMock = jest.fn().mockImplementation(() => Promise.reject(error));
      const TaskConstructorSpy = jest.spyOn(Task.prototype, 'save').mockImplementation(saveMock);

      const response = await importTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
      expect(TaskConstructorSpy).toBeCalled();
    });
  });

  describe('postTask function()', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Return 403 if `postTask` permission is missing', async () => {
      const { postTask } = makeSut();
      hasPermission.mockResolvedValueOnce(false);

      const error = { error: 'You are not authorized to create new Task.' };

      const response = await postTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
    });

    test.each([
      [
        { taskName: undefined, isActive: true },
        'Task Name, Active status are mandatory fields',
      ],
      [
        { taskName: 'some task name', isActive: undefined },
        'Task Name, Active status are mandatory fields',
      ],
      [
        { taskName: undefined, isActive: undefined },
        'Task Name, Active status are mandatory fields',
      ],
    ])('Return 400 if any required field is missing', async (body, expectedError) => {
      const { postTask } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      // Set the request body based on the current test case
      mockReq.body.taskName = body.taskName;
      mockReq.body.isActive = body.isActive;

      const error = { error: expectedError };

      const response = await postTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
    });

    // TODO: Fix
    // test('Return 201 on successfully saving a new Task', async () => {
    //   const { postTask } = makeSut();
    //   hasPermission.mockResolvedValueOnce(true);
    //
    //   const newTask = {
    //     taskName: 'Sample Task',
    //     wbsId: new mongoose.Types.ObjectId(),
    //     num: '1',
    //     level: 1,
    //     position: 1,
    //     childrenQty: 0,
    //     isActive: true,
    //   };
    //
    //   // Mock the current datetime
    //   const currentDate = Date.now();
    //
    //   // Mock Task model
    //   const mockTask = {
    //     save: jest.fn().mockResolvedValue({
    //       _id: new mongoose.Types.ObjectId(),
    //       wbsId: new mongoose.Types.ObjectId(),
    //       createdDatetime: currentDate,
    //       modifiedDatetime: currentDate,
    //     }),
    //   };
    //   const taskSaveSpy = jest.spyOn(Task.prototype, 'save').mockResolvedValue(mockTask);
    //
    //   // Mock WBS model
    //   const mockWBS = {
    //     _id: new mongoose.Types.ObjectId(),
    //     projectId: 'projectId',
    //     modifiedDatetime: Date.now(),
    //     save: jest.fn().mockResolvedValue({
    //       _id: new mongoose.Types.ObjectId(),
    //       projectId: 'projectId',
    //       modifiedDatetime: Date.now(),
    //     }),
    //   };
    //   const wbsFindByIdSpy = jest.spyOn(WBS, 'findById').mockResolvedValue(mockWBS);
    //
    //   // Mock Project model
    //   const mockProjectObj = {
    //     save: jest.fn().mockResolvedValue({
    //       _id: new mongoose.Types.ObjectId(),
    //       modifiedDatetime: currentDate,
    //     }),
    //     modifiedDatetime: currentDate,
    //   };
    //   const projectFindByIdSpy = jest.spyOn(Project, 'findById').mockResolvedValue(mockProjectObj);
    //
    //   // add the necessary request params
    //   mockReq.params = {
    //     ...mockReq.params,
    //     id: new mongoose.Types.ObjectId(),
    //   };
    //
    //   // add the necessary body parameters
    //   mockReq.body = {
    //     ...mockReq.body,
    //     ...newTask,
    //   };
    //
    //   const response = await postTask(mockReq, mockRes);
    //   await flushPromises();
    //
    //   assertResMock(201, expect.anything(), response, mockRes);
    //   expect(taskSaveSpy).toBeCalled();
    //   expect(wbsFindByIdSpy).toBeCalled();
    //   expect(projectFindByIdSpy).toBeCalled();
    // });
    //
    // test('Return 400 on encountering any error during Promise.all', async () => {
    //   const { postTask } = makeSut();
    //   hasPermission.mockResolvedValueOnce(true);
    //
    //   const newTask = {
    //     taskName: 'Sample Task',
    //     wbsId: new mongoose.Types.ObjectId(),
    //     num: '1',
    //     level: 1,
    //     position: 1,
    //     childrenQty: 0,
    //     isActive: true,
    //   };
    //
    //   // Mock the current datetime
    //   const currentDate = Date.now();
    //
    //   // Mock the Task model
    //   const mockTaskError = new Error('Failed to save task');
    //
    //   // Use jest.fn() to mock the save method to reject with an error
    //   const taskSaveMock = jest.fn().mockRejectedValue(mockTaskError);
    //
    //   // Spy on the Task prototype's save method
    //   const taskSaveSpy = jest.spyOn(Task.prototype, 'save').mockImplementation(taskSaveMock);
    //
    //   // Mock WBS model
    //   const mockWBS = {
    //     _id: new mongoose.Types.ObjectId(),
    //     projectId: 'projectId',
    //     modifiedDatetime: Date.now(),
    //     save: jest.fn().mockResolvedValue({
    //       _id: new mongoose.Types.ObjectId(),
    //       projectId: 'projectId',
    //       modifiedDatetime: Date.now(),
    //     }),
    //   };
    //   // Mock `WBS.findById` to return `mockWBS`
    //   const wbsFindByIdSpy = jest.spyOn(WBS, 'findById').mockResolvedValue(mockWBS);
    //
    //   // Mock Project model
    //   const mockProjectObj = {
    //     save: jest.fn().mockResolvedValueOnce({
    //       _id: new mongoose.Types.ObjectId(),
    //       modifiedDatetime: currentDate,
    //     }),
    //     modifiedDatetime: currentDate,
    //   };
    //   const projectFindByIdSpy = jest
    //     .spyOn(Project, 'findById')
    //     .mockResolvedValueOnce(mockProjectObj);
    //
    //   // add the necessary request params
    //   mockReq.params = {
    //     ...mockReq.params,
    //     id: new mongoose.Types.ObjectId(),
    //   };
    //
    //   // add the necessary body parameters
    //   mockReq.body = {
    //     ...mockReq.body,
    //     ...newTask,
    //   };
    //
    //   const response = await postTask(mockReq, mockRes);
    //   await flushPromises();
    //
    //   assertResMock(400, mockTaskError, response, mockRes);
    //   expect(taskSaveSpy).toBeCalled();
    //   expect(wbsFindByIdSpy).toBeCalled();
    //   expect(projectFindByIdSpy).toBeCalled();
    // });
  });

  describe('updateNum function()', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Return 403 if `updateNum` permission is missing', async () => {
      const { updateNum } = makeSut();
      hasPermission.mockResolvedValueOnce(false);

      const error = { error: 'You are not authorized to create new projects.' };

      const response = await updateNum(mockReq, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
    });

    test('Return 400 if `nums` is missing from the request body', async () => {
      const { updateNum } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      const error = { error: 'Num is a mandatory fields' };
      mockReq.body.nums = null;

      const response = await updateNum(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
    });

    test('Return 200 on successful update - nums is empty array', async () => {
      const { updateNum } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.nums = [];

      const response = await updateNum(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, true, response, mockRes);
    });

    test('Return 200 on successful update - nums is not an empty array', async () => {
      const { updateNum } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.nums = [
        {
          id: 'sample-id',
          num: 'sample-num',
        },
      ];

      const mockDataForTaskFindByIdSpy = {
        num: 0,
        save: jest.fn().mockResolvedValue({}),
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockImplementation((id, callback) => {
        callback(null, mockDataForTaskFindByIdSpy);
      });

      const mockDataForTaskFindSpy = [];
      const taskFindSpy = jest.spyOn(Task, 'find').mockResolvedValueOnce(mockDataForTaskFindSpy);

      const response = await updateNum(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, true, response, mockRes);
      expect(taskFindSpy).toBeCalled();
      expect(taskFindByIdSpy).toBeCalled();
    });

    test('Return 404 if error occurs on Task.find()', async () => {
      const { updateNum } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.nums = [
        {
          id: 'sample-id',
          num: 'sample-num',
        },
      ];

      const mockDataForTaskFindByIdSpy = {
        num: 0,
        save: jest.fn().mockResolvedValue({}),
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockImplementation((id, callback) => {
        callback(null, mockDataForTaskFindByIdSpy);
      });

      const mockError = new Error({ error: 'some error occurred' });
      const taskFindSpy = jest.spyOn(Task, 'find').mockRejectedValueOnce(mockError);

      const response = await updateNum(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, mockError, response, mockRes);
      expect(taskFindSpy).toBeCalled();
      expect(taskFindByIdSpy).toBeCalled();
    });

    test('Return 400 if error occurs while saving a Task within Task.findById()', async () => {
      const { updateNum } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.nums = [
        {
          id: 'sample-id',
          num: 'sample-num',
        },
      ];

      const mockError = new Error({ error: 'some error occurred' });

      const mockDataForTaskFindByIdSpy = {
        num: 0,
        save: jest.fn().mockRejectedValueOnce(mockError),
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockImplementation((id, callback) => {
        callback(null, mockDataForTaskFindByIdSpy);
      });

      const mockDataForTaskFindSpy = [];
      const taskFindSpy = jest.spyOn(Task, 'find').mockResolvedValueOnce(mockDataForTaskFindSpy);

      const response = await updateNum(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, mockError, response, mockRes);
      expect(taskFindSpy).toBeCalled();
      expect(taskFindByIdSpy).toBeCalled();
    });
  });

  describe('moveTask function()', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Return 400 if either `fromNum` or `toNum` is missing in request body', async () => {
      const { moveTask } = makeSut();

      const error = { error: 'wbsId, fromNum, toNum are mandatory fields' };
      mockReq.body.fromNum = null;

      const response = await moveTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
    });

    test('Return 200 on successful exeecution', async () => {
      const { moveTask } = makeSut();

      const requestData = {
        body: {
          fromNum: '1.0',
          toNum: '2.0',
        },
      };

      mockReq.body = {
        ...mockReq.body,
        ...requestData.body,
      };

      const taskFindSpy = jest.spyOn(Task, 'find').mockResolvedValue([
        { num: '1.0', save: jest.fn().mockResolvedValue({}) },
        { num: '1.1', save: jest.fn().mockResolvedValue({}) },
      ]);

      mockReq.params.wbsId = 'someWbsId';

      const response = await moveTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, 'Success!', response, mockRes);
      expect(taskFindSpy).toBeCalled();
    });

    test('Return 400 on some error', async () => {
      const { moveTask } = makeSut();

      const requestData = {
        body: {
          fromNum: '1.0',
          toNum: '2.0',
        },
      };

      mockReq.body = {
        ...mockReq.body,
        ...requestData.body,
      };

      const error = new Error({ error: 'some error' });
      const taskFindSpy = jest.spyOn(Task, 'find').mockResolvedValue([
        { num: '1.0', save: jest.fn().mockResolvedValue({}) },
        { num: '1.1', save: jest.fn().mockRejectedValueOnce(error) },
      ]);

      mockReq.params.wbsId = 'someWbsId';

      const response = await moveTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
      expect(taskFindSpy).toBeCalled();
    });
  });

  describe('deleteTask function()', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Return 403 if `deleteTask` permission is missing', async () => {
      const { deleteTask } = makeSut();
      hasPermission.mockResolvedValueOnce(false);

      const error = { error: 'You are not authorized to deleteTasks.' };

      const response = await deleteTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
    });

    test('Return 400 if no Task found', async () => {
      const { deleteTask } = makeSut();

      const error = { error: 'No valid records found' };
      hasPermission.mockResolvedValueOnce(true);

      mockReq.params = {
        ...mockReq.params,
        taskId: 456,
        mother: 'null',
      };

      const taskFindSpy = jest.spyOn(Task, 'find').mockResolvedValue([]);
      const followUpFindOneAndDeleteSpy = jest
        .spyOn(FollowUp, 'findOneAndDelete')
        .mockResolvedValue(true);

      const response = await deleteTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
      expect(taskFindSpy).toHaveBeenCalled();
      expect(followUpFindOneAndDeleteSpy).toHaveBeenCalled();
    });

    test('Return 200 on successfully deleting task', async () => {
      const { deleteTask } = makeSut();

      const message = { message: 'Task successfully deleted' };
      hasPermission.mockResolvedValueOnce(true);

      mockReq.params = {
        ...mockReq.params,
        taskId: 456,
        mother: 'null',
      };

      const taskFindSpy = jest.spyOn(Task, 'find').mockResolvedValue([
        {
          remove: jest.fn().mockImplementation(() => Promise.resolve(1)),
        },
      ]);
      const followUpFindOneAndDeleteSpy = jest
        .spyOn(FollowUp, 'findOneAndDelete')
        .mockResolvedValue(true);

      const response = await deleteTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, message, response, mockRes);
      expect(taskFindSpy).toHaveBeenCalled();
      expect(followUpFindOneAndDeleteSpy).toHaveBeenCalled();
    });
  });

  describe('deleteTaskByWBS function()', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Return 403 if `deleteTask` permission is missing', async () => {
      const { deleteTaskByWBS } = makeSut();
      hasPermission.mockResolvedValueOnce(false);

      const error = { error: 'You are not authorized to deleteTasks.' };

      const response = await deleteTaskByWBS(mockReq, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
    });

    test('Return 400 if no Task found', async () => {
      const { deleteTaskByWBS } = makeSut();

      const error = { error: 'No valid records found' };
      hasPermission.mockResolvedValueOnce(true);

      mockReq.params = {
        ...mockReq.params,
        wbsId: 456,
      };

      const taskFindSpy = jest.spyOn(Task, 'find').mockImplementation((query, callback) => {
        callback(null, []);
        return {
          catch: jest.fn(),
        };
      });

      const response = await deleteTaskByWBS(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
      expect(taskFindSpy).toHaveBeenCalled();
    });

    test('Return 400 if Task.find fails', async () => {
      const { deleteTaskByWBS } = makeSut();

      const expectedError = new Error('Database error');
      hasPermission.mockResolvedValueOnce(true);

      mockReq.params = {
        ...mockReq.params,
        wbsId: 456,
      };

      const taskFindSpy = jest.spyOn(Task, 'find').mockImplementation((query, callback) => {
        callback(expectedError, null);
        return {
          catch: jest.fn((catchCallback) => {
            catchCallback(expectedError);
            return Promise.resolve();
          }),
        };
      });

      const response = await deleteTaskByWBS(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, expectedError, response, mockRes);
      expect(taskFindSpy).toHaveBeenCalled();
    });

    test('Return 200 on successfully deleting task', async () => {
      const { deleteTaskByWBS } = makeSut();

      const message = { message: ' Tasks were successfully deleted' };
      hasPermission.mockResolvedValueOnce(true);

      mockReq.params = {
        ...mockReq.params,
        wbsId: 456,
      };

      const taskFindSpy = jest.spyOn(Task, 'find').mockImplementation((query, callback) => {
        callback(null, [
          {
            remove: jest.fn().mockImplementation(() => Promise.resolve(1)),
          },
        ]);
        return {
          catch: jest.fn(),
        };
      });

      const followUpFindOneAndDeleteSpy = jest
        .spyOn(FollowUp, 'findOneAndDelete')
        .mockResolvedValue(true);

      const response = await deleteTaskByWBS(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, message, response, mockRes);
      expect(taskFindSpy).toHaveBeenCalled();
      expect(followUpFindOneAndDeleteSpy).toHaveBeenCalled();
    });
  });

  describe('updateTask function()', () => {
    const mockedTask = {
      wbs: 111,
    };
    const mockedWBS = {
      projectId: 111,
      modifiedDatetime: new Date(),
      save: jest.fn(),
    };
    const mockedProject = {
      projectId: 111,
      modifiedDatetime: new Date(),
      save: jest.fn(),
    };

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Return 403 if `updateTask` permission is missing', async () => {
      const { updateTask } = makeSut();
      hasPermission.mockResolvedValueOnce(false);

      const error = { error: 'You are not authorized to update Task.' };

      const response = await updateTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
    });

    test('Return 200 on successful update', async () => {
      const { updateTask } = makeSut();

      hasPermission.mockResolvedValueOnce(true);

      mockReq.params = {
        ...mockReq.params,
        taskId: 456,
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockResolvedValue(mockedTask);
      const taskFindOneAndUpdateSpy = jest
        .spyOn(Task, 'findOneAndUpdate')
        .mockResolvedValueOnce(true);
      const wbsFindByIdSpy = jest.spyOn(WBS, 'findById').mockResolvedValue(mockedWBS);
      const projectFindByIdSpy = jest.spyOn(Project, 'findById').mockResolvedValue(mockedProject);

      const response = await updateTask(mockReq, mockRes);
      await flushPromises();

      // assertResMock(201, null, response, mockRes);
      expect(mockRes.status).toBeCalledWith(201);
      expect(response).toBeUndefined();
      expect(taskFindByIdSpy).toHaveBeenCalled();
      expect(taskFindOneAndUpdateSpy).toHaveBeenCalled();
      expect(wbsFindByIdSpy).toHaveBeenCalled();
      expect(projectFindByIdSpy).toHaveBeenCalled();
    });

    test('Return 404 on encountering error', async () => {
      const { updateTask } = makeSut();

      const error = { error: 'No valid records found' };
      hasPermission.mockResolvedValueOnce(true);

      mockReq.params = {
        ...mockReq.params,
        taskId: 456,
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockResolvedValue(mockedTask);
      const taskFindOneAndUpdateSpy = jest
        .spyOn(Task, 'findOneAndUpdate')
        .mockRejectedValueOnce(error);
      const wbsFindByIdSpy = jest.spyOn(WBS, 'findById').mockResolvedValue(mockedWBS);
      const projectFindByIdSpy = jest.spyOn(Project, 'findById').mockResolvedValue(mockedProject);

      const response = await updateTask(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, error, response, mockRes);
      expect(taskFindByIdSpy).toHaveBeenCalled();
      expect(taskFindOneAndUpdateSpy).toHaveBeenCalled();
      expect(wbsFindByIdSpy).toHaveBeenCalled();
      expect(projectFindByIdSpy).toHaveBeenCalled();
    });
  });

  describe('swap function()', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Return 403 if `swapTask` permission is missing', async () => {
      const { swap } = makeSut();
      hasPermission.mockResolvedValueOnce(false);

      const error = { error: 'You are not authorized to create new projects.' };

      const response = await swap(mockReq, mockRes);
      await flushPromises();

      assertResMock(403, error, response, mockRes);
    });

    test('Return 400 if `taskId1` is missing', async () => {
      const { swap } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.taskId1 = null;
      mockReq.body.taskId2 = 'some-value';

      const error = { error: 'taskId1 and taskId2 are mandatory fields' };

      const response = await swap(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
    });

    test('Return 400 if `taskId2` is missing', async () => {
      const { swap } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.taskId1 = 'some-value';
      mockReq.body.taskId2 = null;

      const error = { error: 'taskId1 and taskId2 are mandatory fields' };

      const response = await swap(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
    });

    test('Return 400 if `taskId1` and `taskId2` are missing', async () => {
      const { swap } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.taskId1 = null;
      mockReq.body.taskId2 = null;

      const error = { error: 'taskId1 and taskId2 are mandatory fields' };

      const response = await swap(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
    });

    test('Return 400 if no task exists with the id same as `taskId1`', async () => {
      const { swap } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.taskId1 = 'invalid-taskId1';
      mockReq.body.taskId2 = 'some value';

      const error = 'No valid records found';

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockImplementation((id, callback) => {
        if (id === 'invalid-taskId1') {
          callback(null, null); // the first null shows no error | second null show no task1
        } else if (id === 'invalid-taskId2') {
          callback(null, 'some task2 exists');
        }
      });

      const response = await swap(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
      expect(taskFindByIdSpy).toHaveBeenCalled();
    });

    test('Return 400 if no task exists with the id same as `taskId2`', async () => {
      const { swap } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.taskId1 = 'valid-taskId1';
      mockReq.body.taskId2 = 'invalid-taskId2';

      const error = 'No valid records found';

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockImplementation((id, callback) => {
        if (id === 'valid-taskId1') {
          callback(null, { _id: 'valid-taskId1', name: 'Task 1' });
        }

        if (id === 'invalid-taskId2') {
          callback(null, null); // the first null shows no error | second null show no task2 found
        }
      });

      const response = await swap(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
      expect(taskFindByIdSpy).toHaveBeenCalledTimes(2);
      expect(taskFindByIdSpy).toHaveBeenNthCalledWith(1, 'valid-taskId1', expect.any(Function));
      expect(taskFindByIdSpy).toHaveBeenNthCalledWith(2, 'invalid-taskId2', expect.any(Function));
    });

    test('Return 400 if some error occurs while saving task1', async () => {
      const { swap } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.taskId1 = 'valid-taskId1';
      mockReq.body.taskId2 = 'valid-taskId2';

      const error = 'some error';

      const validTask1 = {
        _id: 'valid-taskId1',
        name: 'Task 1',
        num: 1,
        parentId: 'pId',
        save: jest.fn().mockRejectedValue(error),
      };

      const validTask2 = {
        _id: 'valid-taskId2',
        name: 'Task 2',
        num: 2,
        parentId: 'pId',
        save: jest.fn().mockResolvedValue('sadasd'),
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockImplementation((id, callback) => {
        if (id === 'valid-taskId1') {
          callback(null, validTask1);
        }
        if (id === 'valid-taskId2') {
          callback(null, validTask2);
        }
      });

      const taskFindSpy = jest.spyOn(Task, 'find').mockResolvedValueOnce('works fine');

      const response = await swap(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
      expect(taskFindByIdSpy).toHaveBeenCalled();
      expect(taskFindSpy).toHaveBeenCalled();
    });

    test('Return 400 if some error occurs while saving task2', async () => {
      const { swap } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.taskId1 = 'valid-taskId1';
      mockReq.body.taskId2 = 'valid-taskId2';

      const error = 'some error';

      const validTask1 = {
        _id: 'valid-taskId1',
        name: 'Task 1',
        num: 1,
        parentId: 'pId',
        save: jest.fn().mockResolvedValue(),
      };

      const validTask2 = {
        _id: 'valid-taskId2',
        name: 'Task 2',
        num: 2,
        parentId: 'pId',
        save: jest.fn().mockRejectedValue(error),
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockImplementation((id, callback) => {
        if (id === 'valid-taskId1') {
          callback(null, validTask1);
        }
        if (id === 'valid-taskId2') {
          callback(null, validTask2);
        }
      });

      const taskFindSpy = jest.spyOn(Task, 'find').mockResolvedValueOnce('works fine');

      const response = await swap(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
      expect(taskFindByIdSpy).toHaveBeenCalled();
      expect(taskFindSpy).toHaveBeenCalled();
    });

    test('Return 404 if some error occurs while saving task.find', async () => {
      const { swap } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.taskId1 = 'valid-taskId1';
      mockReq.body.taskId2 = 'valid-taskId2';

      const error = 'some error';

      const validTask1 = {
        _id: 'valid-taskId1',
        name: 'Task 1',
        num: 1,
        parentId: 'pId',
        save: jest.fn().mockResolvedValue(),
      };

      const validTask2 = {
        _id: 'valid-taskId2',
        name: 'Task 2',
        num: 2,
        parentId: 'pId',
        save: jest.fn().mockResolvedValue(),
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockImplementation((id, callback) => {
        if (id === 'valid-taskId1') {
          callback(null, validTask1);
        }
        if (id === 'valid-taskId2') {
          callback(null, validTask2);
        }
      });

      const taskFindSpy = jest.spyOn(Task, 'find').mockRejectedValueOnce(error);

      const response = await swap(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, error, response, mockRes);
      expect(taskFindByIdSpy).toHaveBeenCalled();
      expect(taskFindSpy).toHaveBeenCalled();
    });

    test('Return 200 if swapped correctly', async () => {
      const { swap } = makeSut();
      hasPermission.mockResolvedValueOnce(true);

      mockReq.body.taskId1 = 'valid-taskId1';
      mockReq.body.taskId2 = 'valid-taskId2';

      const message = 'no error';

      const validTask1 = {
        _id: 'valid-taskId1',
        name: 'Task 1',
        num: 1,
        parentId: 'pId',
        save: jest.fn().mockResolvedValue(),
      };

      const validTask2 = {
        _id: 'valid-taskId2',
        name: 'Task 2',
        num: 2,
        parentId: 'pId',
        save: jest.fn().mockResolvedValue(),
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockImplementation((id, callback) => {
        if (id === 'valid-taskId1') {
          callback(null, validTask1);
        }
        if (id === 'valid-taskId2') {
          callback(null, validTask2);
        }
      });

      const taskFindSpy = jest.spyOn(Task, 'find').mockResolvedValueOnce(message);

      const response = await swap(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, message, response, mockRes);
      expect(taskFindByIdSpy).toHaveBeenCalled();
      expect(taskFindSpy).toHaveBeenCalled();
    });
  });

  describe('getTaskById function()', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Returns 400 if the taskId is missing from the params', async () => {
      const { getTaskById } = makeSut();

      mockReq.params.id = null;

      const error = { error: 'Task ID is missing' };

      const response = await getTaskById(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
    });

    test('Returns 400 if the taskId is missing from the params', async () => {
      const { getTaskById } = makeSut();

      mockReq.params.id = 'someTaskId';

      const error = { error: 'This is not a valid task' };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockResolvedValueOnce(null);

      const response = await getTaskById(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
      expect(taskFindByIdSpy).toHaveBeenCalled();
    });

    test('Returns 500 if some error occurs at Task.findById', async () => {
      const { getTaskById } = makeSut();

      mockReq.params.id = 'someTaskId';

      const error = new Error('some error occurred');

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockRejectedValueOnce(error);

      const response = await getTaskById(mockReq, mockRes);
      await flushPromises();

      assertResMock(
        500,
        { error: 'Internal Server Error', details: error.message },
        response,
        mockRes,
      );
      expect(taskFindByIdSpy).toHaveBeenCalled();
    });

    test('Returns 200 if some error occurs at Task.findById', async () => {
      const { getTaskById } = makeSut();

      mockReq.params.id = 'someTaskId';

      const mockTask = {
        resources: [],
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockResolvedValueOnce(mockTask);

      const response = await getTaskById(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, mockTask, response, mockRes);
      expect(taskFindByIdSpy).toHaveBeenCalled();
    });
  });

  describe('fixTasks function()', () => {
    test('Returns 200 without performing any action', async () => {
      const { fixTasks } = makeSut();

      const response = fixTasks(mockReq, mockRes);

      await flushPromises();

      assertResMock(200, 'done', response, mockRes);
    });
  });

  describe('updateAllParents function()', () => {
    test('Returns 200 Task.Find() on successful operation', async () => {
      const { updateAllParents } = makeSut();

      const mockTasks = [];

      const taskFind = jest.spyOn(Task, 'find').mockResolvedValueOnce(mockTasks);
      const response = updateAllParents(mockReq, mockRes);

      await flushPromises();

      assertResMock(200, 'done', response, mockRes);
      expect(taskFind).toHaveBeenCalled();
    });

    test('Returns 400 on some error', async () => {
      const { updateAllParents } = makeSut();

      const error = new Error('some error');

      const taskFind = jest.spyOn(Task, 'find').mockImplementationOnce(() => {
        throw error;
      });
      const response = await updateAllParents(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
      expect(taskFind).toHaveBeenCalled();
    });
  });

  describe('getTasksByUserId function()', () => {
    test('Returns 200 and tasks when aggregation is successful', async () => {
      const { getTasksByUserId } = makeSut();

      mockReq.params.userId = '507f1f77bcf86cd799439011';

      const mockTasks = [
        { _id: 'task1', taskName: 'Task 1', wbsName: 'WBS 1', projectName: 'Project 1' },
        { _id: 'task2', taskName: 'Task 2', wbsName: 'WBS 2', projectName: 'Project 2' },
      ];

      // Mock the Task.aggregate method
      const mockAggregate = {
        match: jest.fn().mockReturnThis(),
        lookup: jest.fn().mockReturnThis(),
        unwind: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        project: jest.fn().mockReturnThis(),
      };

      mockAggregate.project.mockResolvedValue(mockTasks);

      const taskAggregate = jest.spyOn(Task, 'aggregate').mockReturnValue(mockAggregate);

      const response = await getTasksByUserId(mockReq, mockRes);

      assertResMock(200, mockTasks, response, mockRes);
      expect(taskAggregate).toHaveBeenCalled();
    });

    test('Returns 400 when error occurs', async () => {
      const { getTasksByUserId } = makeSut();

      mockReq.params.userId = '507f1f77bcf86cd799439011';

      const mockError = new Error('some error');

      // Mock the Task.aggregate method
      const mockAggregate = {
        match: jest.fn().mockReturnThis(),
        lookup: jest.fn().mockReturnThis(),
        unwind: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        project: jest.fn().mockReturnThis(),
      };

      mockAggregate.project.mockRejectedValueOnce(mockError);

      const taskAggregate = jest.spyOn(Task, 'aggregate').mockReturnValue(mockAggregate);

      const response = await getTasksByUserId(mockReq, mockRes);

      assertResMock(400, mockError, response, mockRes);
      expect(taskAggregate).toHaveBeenCalled();
    });
  });

  describe('sendReviewReq function()', () => {
    test('Returns 200 on success', async () => {
      const { sendReviewReq } = makeSut();

      mockReq.body = {
        ...mockReq.body,
        myUserId: 'id',
        name: 'name',
        taskName: 'task',
      };

      const userProfileFindByIdSpy = jest.spyOn(UserProfile, 'findById').mockResolvedValueOnce([]);
      const userProfileFindSpy = jest.spyOn(UserProfile, 'find').mockResolvedValueOnce([]);

      const response = await sendReviewReq(mockReq, mockRes);

      assertResMock(200, 'Success', response, mockRes);
      expect(emailSender).toHaveBeenCalledWith(
        [],
        expect.any(String),
        expect.any(String),
        null,
        null,
      );
      expect(userProfileFindByIdSpy).toHaveBeenCalled();
      expect(userProfileFindSpy).toHaveBeenCalled();
    });

    test('Returns 400 on error', async () => {
      const { sendReviewReq } = makeSut();

      mockReq.body = {
        ...mockReq.body,
        myUserId: 'id',
        name: 'name',
        taskName: 'task',
      };

      const mockError = new Error('some error');

      emailSender.mockImplementation(() => mockError);

      const userProfileFindByIdSpy = jest.spyOn(UserProfile, 'findById').mockResolvedValueOnce([]);
      const userProfileFindSpy = jest.spyOn(UserProfile, 'find').mockResolvedValueOnce([]);

      const response = await sendReviewReq(mockReq, mockRes);

      assertResMock(400, mockError, response, mockRes);

      expect(emailSender).toHaveBeenCalledWith(
        [],
        expect.any(String),
        expect.any(String),
        null,
        null,
      );
      expect(userProfileFindByIdSpy).toHaveBeenCalled();
      expect(userProfileFindSpy).toHaveBeenCalled();
    });
  });

  describe('getTasksForTeamsByUser function()', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('Returns 200 on success - getTasksForTeams', async () => {
      mockReq.params.userId = 1234;
      const mockData = ['mockData'];

      taskHelperMethods.getTasksForTeams.mockResolvedValueOnce(mockData);

      const { getTasksForTeamsByUser } = makeSut();

      const response = await getTasksForTeamsByUser(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, mockData, response, mockRes);
    });

    test('Returns 200 on success - getTasksForTeamsByUser', async () => {
      mockReq.params.userId = 1234;
      const mockData = ['mockData'];

      const execMock = {
        exec: jest.fn().mockResolvedValueOnce(mockData),
      };

      taskHelperMethods.getTasksForTeams.mockResolvedValueOnce([]);
      taskHelperMethods.getTasksForSingleUser.mockImplementation(() => execMock);

      const { getTasksForTeamsByUser } = makeSut();

      const response = await getTasksForTeamsByUser(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, mockData, response, mockRes);
    });

    test('Returns 400 on error', async () => {
      mockReq.params.userId = 1234;
      const mockError = new Error('error');

      taskHelperMethods.getTasksForTeams.mockRejectedValueOnce(mockError);

      const { getTasksForTeamsByUser } = makeSut();

      const response = await getTasksForTeamsByUser(mockReq, mockRes);
      await flushPromises();

      assertResMock(400, { error: mockError }, response, mockRes);
    });
  });

  describe('updateTaskStatus function()', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const mockedTask = {
      wbs: 111,
    };
    const mockedWBS = {
      projectId: 111,
      modifiedDatetime: new Date(),
      save: jest.fn(),
    };
    const mockedProject = {
      projectId: 111,
      modifiedDatetime: new Date(),
      save: jest.fn(),
    };

    test('Returns 200 on success - updateTaskStatus', async () => {
      const { updateTaskStatus } = makeSut();

      mockReq.params = {
        ...mockReq.params,
        taskId: 456,
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockResolvedValue(mockedTask);
      const taskFindOneAndUpdateSpy = jest
        .spyOn(Task, 'findOneAndUpdate')
        .mockResolvedValueOnce(true);
      const wbsFindByIdSpy = jest.spyOn(WBS, 'findById').mockResolvedValue(mockedWBS);
      const projectFindByIdSpy = jest.spyOn(Project, 'findById').mockResolvedValue(mockedProject);

      const response = await updateTaskStatus(mockReq, mockRes);
      await flushPromises();

      // assertResMock(201, null, response, mockRes);
      expect(mockRes.status).toBeCalledWith(201);
      expect(response).toBeUndefined();
      expect(taskFindByIdSpy).toHaveBeenCalled();
      expect(taskFindOneAndUpdateSpy).toHaveBeenCalled();
      expect(wbsFindByIdSpy).toHaveBeenCalled();
      expect(projectFindByIdSpy).toHaveBeenCalled();
    });

    test('Returns 400 on error', async () => {
      const { updateTaskStatus } = makeSut();
      const error = new Error('some error');

      mockReq.params = {
        ...mockReq.params,
        taskId: 456,
      };

      const taskFindByIdSpy = jest.spyOn(Task, 'findById').mockResolvedValue(mockedTask);
      const taskFindOneAndUpdateSpy = jest
        .spyOn(Task, 'findOneAndUpdate')
        .mockRejectedValueOnce(error);
      const wbsFindByIdSpy = jest.spyOn(WBS, 'findById').mockResolvedValue(mockedWBS);
      const projectFindByIdSpy = jest.spyOn(Project, 'findById').mockResolvedValue(mockedProject);

      const response = await updateTaskStatus(mockReq, mockRes);
      await flushPromises();

      assertResMock(404, error, response, mockRes);

      expect(taskFindByIdSpy).toHaveBeenCalled();
      expect(taskFindOneAndUpdateSpy).toHaveBeenCalled();
      expect(wbsFindByIdSpy).toHaveBeenCalled();
      expect(projectFindByIdSpy).toHaveBeenCalled();
    });
  });
});
