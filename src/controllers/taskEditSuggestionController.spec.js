const mongoose = require('mongoose');

const {
  mockReq,
  mockRes,
  mongoHelper: { dbConnect, dbDisconnect },
  assertResMock,
} = require('../test');

const wbs = require('../models/wbs');
const userProfile = require('../models/userProfile');
const helper = require('../utilities/permissions');
const TaskEditSuggestion = require('../models/taskEditSuggestion');
// const escapeRegex = require('../utilities/escapeRegex');
// const userProject = require('../helpers/helperModels/userProjects');

const taskEditSuggestionController = require('./taskEditSuggestionController');

// mock the cache function before importing so we can manipulate the implementation
jest.mock('../utilities/nodeCache');
// const cache = require('../utilities/nodeCache');

const makeSut = () => {
  const { createOrUpdateTaskEditSuggestion, findAllTaskEditSuggestions, deleteTaskEditSuggestion } =
    taskEditSuggestionController(TaskEditSuggestion);

  return {
    createOrUpdateTaskEditSuggestion,
    findAllTaskEditSuggestions,
    deleteTaskEditSuggestion,
  };
};

const mockHasPermission = (value) =>
  jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

const flushPromises = () => new Promise(setImmediate);

describe('taskEditSuggestionController module', () => {
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

  describe('createOrUpdateTaskEditSuggestion function', () => {
    const mockReqModified = {
      ...mockReq,
      body: {
        ...mockReq.body,
        ...{
          userId: '60d5ec49f1e3b72b9c7b9f33',
          oldTask: {
            wbsId: '60d5ec49f1e3b72b9c7b9f44',
            taskId: '60d5ec49f1e3b72b9c7b9f55',
          },
          taskId: '60d5ec49f1e3b72b9c7b9f55',
          newTask: {},
        },
      },
    };
    test('Ensure createOrUpdateTaskEditSuggestion returns 400 if an error occurs in finding userProfile by id', async () => {
      const { createOrUpdateTaskEditSuggestion } = makeSut();
      const errMsg = new Error('Error occured when finding userProfile by id');

      jest.spyOn(userProfile, 'findById').mockImplementation(() => ({
        select: jest.fn().mockRejectedValue(errMsg),
      }));

      const response = await createOrUpdateTaskEditSuggestion(mockReqModified, mockRes);
      assertResMock(400, errMsg, response, mockRes);
    });

    test('Ensure createOrUpdateTaskEditSuggestion returns 400 if an error occurs in finding wbs by id', async () => {
      const { createOrUpdateTaskEditSuggestion } = makeSut();
      const errMsg = new Error('Error occured when finding wbs by id');

      jest.spyOn(userProfile, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({ firstName: 'John', lastName: 'Doe' }),
      }));

      jest.spyOn(wbs, 'findById').mockImplementation(() => ({
        select: jest.fn().mockRejectedValue(errMsg),
      }));

      const response = await createOrUpdateTaskEditSuggestion(mockReqModified, mockRes);
      assertResMock(400, errMsg, response, mockRes);
    });

    test('Ensure createOrUpdateTaskEditSuggestion returns 400 if an error occurs in finding userProfile by projectId', async () => {
      const { createOrUpdateTaskEditSuggestion } = makeSut();
      const errMsg = new Error('Error occured when finding userProfile by projectId');

      jest.spyOn(userProfile, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({ firstName: 'John', lastName: 'Doe' }),
      }));

      jest.spyOn(wbs, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({ projectId: '60d5ec49f1e3b72b9c7b9f66' }),
      }));

      jest.spyOn(userProfile, 'find').mockImplementation(() => ({
        sort: jest.fn().mockRejectedValue(errMsg),
      }));

      const response = await createOrUpdateTaskEditSuggestion(mockReqModified, mockRes);
      assertResMock(400, errMsg, response, mockRes);
    });

    test('Ensure createOrUpdateTaskEditSuggestion returns 400 TaskEditSuggestion.findOneAndUpdate fails', async () => {
      const { createOrUpdateTaskEditSuggestion } = makeSut();
      const errMsg = new Error('Error occured when TaskEditSuggestion.findOneAndUpdate fails');

      jest.spyOn(userProfile, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({ firstName: 'John', lastName: 'Doe' }),
      }));

      jest.spyOn(wbs, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({ projectId: '60d5ec49f1e3b72b9c7b9f66' }),
      }));

      jest.spyOn(userProfile, 'find').mockImplementation(() => ({
        sort: jest.fn().mockResolvedValue([
          {
            _id: '1234',
            firstName: 'Jane',
            lastName: 'Smith',
            profilePic: 'pic.jpg',
          },
        ]),
      }));

      jest.spyOn(TaskEditSuggestion, 'findOneAndUpdate').mockRejectedValue(errMsg);

      const response = await createOrUpdateTaskEditSuggestion(mockReqModified, mockRes);
      assertResMock(400, errMsg, response, mockRes);
    });

    test('Ensure createOrUpdateTaskEditSuggestion returns 200 and create or update a TaskEditSuggestion successfully', async () => {
      const { createOrUpdateTaskEditSuggestion } = makeSut();
      jest.spyOn(userProfile, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({ firstName: 'John', lastName: 'Doe' }),
      }));

      jest.spyOn(wbs, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({ projectId: '60d5ec49f1e3b72b9c7b9f66' }),
      }));

      jest.spyOn(userProfile, 'find').mockImplementation(() => ({
        sort: jest.fn().mockResolvedValue([
          {
            _id: '1234',
            firstName: 'Jane',
            lastName: 'Smith',
            profilePic: 'pic.jpg',
          },
        ]),
      }));

      // const options = {
      //   upsert: true,           // Create a new document if no document matches the query
      //   new: true,              // Return the modified document rather than the original
      //   setDefaultsOnInsert: true, // Apply default values specified in the schema if a new document is created
      //   rawResult: true         // Return the raw result from the MongoDB driver
      // };

      const result = new Object(
        { taskId: mongoose.Types.ObjectId(mockReqModified.body.taskId) },
        {
          userId: mockReqModified.body.userId,
          user: 'John Doe',
          dateSuggested: expect.any(Number),
          taskId: mockReqModified.body.taskId,
          wbsId: mockReqModified.body.oldTask.wbsId,
          projectId: '60d5ec49f1e3b72b9c7b9f66',
          oldTask: mockReqModified.body.oldTask,
          newTask: mockReqModified.body.newTask,
          projectMembers: [
            {
              _id: '1234',
              firstName: 'Jane',
              lastName: 'Smith',
              profilePic: 'pic.jpg',
            },
          ],
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true },
      );

      jest.spyOn(TaskEditSuggestion, 'findOneAndUpdate').mockResolvedValue(result);

      const response = await createOrUpdateTaskEditSuggestion(mockReqModified, mockRes);
      assertResMock(200, result, response, mockRes);
    });
  });

  describe('findAllTaskEditSuggestions function', () => {
    const mockReqModified = {
      ...mockReq,
      query: {},
    };

    test('Ensure findAllTaskEditSuggestions returns 400 when if TaskEditSuggestion.countDocuments fails', async () => {
      const { findAllTaskEditSuggestions } = makeSut();

      mockReqModified.query.count = 'true';
      const mockError = new Error('countDocuments failed');
      jest.spyOn(TaskEditSuggestion, 'countDocuments').mockRejectedValue(mockError);

      const response = await findAllTaskEditSuggestions(mockReqModified, mockRes);

      assertResMock(400, mockError, response, mockRes);
      expect(TaskEditSuggestion.countDocuments).toHaveBeenCalled();
    });

    test('Ensure findAllTaskEditSuggestions returns 400 when if TaskEditSuggestion.find fails', async () => {
      const { findAllTaskEditSuggestions } = makeSut();

      mockReqModified.query.count = {};
      const mockError = new Error('find failed');
      jest.spyOn(TaskEditSuggestion, 'find').mockRejectedValue(mockError);

      const response = await findAllTaskEditSuggestions(mockReqModified, mockRes);

      assertResMock(400, mockError, response, mockRes);
    });

    test('Ensure findAllTaskEditSuggestions returns 200 and the count of TaskEditSuggestion documents when count query is true', async () => {
      const { findAllTaskEditSuggestions } = makeSut();

      mockReqModified.query.count = 'true';
      const mockCount = 10;
      jest.spyOn(TaskEditSuggestion, 'countDocuments').mockResolvedValue(mockCount);

      const response = await findAllTaskEditSuggestions(mockReqModified, mockRes);

      assertResMock(200, { count: mockCount }, response, mockRes);
      expect(TaskEditSuggestion.countDocuments).toHaveBeenCalled();
    });

    test('Ensure findAllTaskEditSuggestions returns 200 and the count of TaskEditSuggestion documents when count query is true', async () => {
      const { findAllTaskEditSuggestions } = makeSut();
      mockReqModified.query.count = {};
      console.log('mock', mockReqModified);

      const mockResults = [
        { _id: '1', userId: 'user1', taskId: 'task1' },
        { _id: '2', userId: 'user2', taskId: 'task2' },
      ];

      jest.spyOn(TaskEditSuggestion, 'find').mockResolvedValue(mockResults);

      const response = await findAllTaskEditSuggestions(mockReqModified, mockRes);

      assertResMock(200, mockResults, response, mockRes);
    });
  });

  describe('deleteTaskEditSuggestion function', () => {
    const mockReqModified = {
      ...mockReq,
      param: {
        ...mockReq.params,
      },
    };

    test('Ensure deleteTaskEditSuggestion returns 400 if an error occurs in delete', async () => {
      const { deleteTaskEditSuggestion } = makeSut();
      const errMsg = new Error('Error occured when deleting taskEditSuggestion');

      jest.spyOn(TaskEditSuggestion, 'deleteOne').mockRejectedValue(errMsg);

      const response = await deleteTaskEditSuggestion(mockReqModified, mockRes);
      assertResMock(400, errMsg, response, mockRes);
    });

    test('Ensure deleteTaskEditSuggestion returns 200 and message if the delete was successful', async () => {
      const { deleteTaskEditSuggestion } = makeSut();
      const msg = `Deleted task edit suggestion with _id: ${mockReqModified.param.taskEditSuggestionId}`;

      jest.spyOn(TaskEditSuggestion, 'deleteOne').mockResolvedValue();

      const response = await deleteTaskEditSuggestion(mockReqModified, mockRes);
      assertResMock(200, { message: msg }, response, mockRes);
    });
  });
});
