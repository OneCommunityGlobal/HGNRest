// Utility to aid in testing
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const flushPromises = () => new Promise(setImmediate);
const { mockReq, mockRes, assertResMock } = require('../test');
const { hasPermission } = require('../utilities/permissions');

// controller to test
const taskController = require('./taskController');

// MongoDB Model imports
const Task = require('../models/task');
const WBS = require('../models/wbs');

const makeSut = () => {
  const { getTasks, getWBSId, importTask } = taskController(Task);

  return {
    getTasks,
    getWBSId,
    importTask,
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
});
