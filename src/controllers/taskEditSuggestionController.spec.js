const mongoose = require('mongoose');
const { mockRes, assertResMock } = require('../test');

const flushPromises = () => new Promise(setImmediate);

jest.mock('../models/userProfile', () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../models/wbs', () => ({
  findById: jest.fn(),
}));

const userProfile = require('../models/userProfile');
const wbs = require('../models/wbs');
const taskEditSuggestionController = require('./taskEditSuggestionController');

const makeSut = (TaskEditSuggestionModel) => {
  const { createOrUpdateTaskEditSuggestion, findAllTaskEditSuggestions, deleteTaskEditSuggestion } =
    taskEditSuggestionController(TaskEditSuggestionModel);

  return {
    createOrUpdateTaskEditSuggestion,
    findAllTaskEditSuggestions,
    deleteTaskEditSuggestion,
  };
};

const mockFindWithSort = (resolvedValue) => {
  const sort = jest.fn().mockResolvedValue(resolvedValue);
  userProfile.find.mockImplementationOnce(() => ({ sort }));
  return { sort };
};

describe('Unit Tests for taskEditSuggestionController.js', () => {
  afterAll(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrUpdateTaskEditSuggestion()', () => {
    test('should return 200 and upsert when dependencies succeed', async () => {
      const TaskEditSuggestion = {
        findOneAndUpdate: jest.fn(),
      };
      const { createOrUpdateTaskEditSuggestion } = makeSut(TaskEditSuggestion);

      const ids = {
        userId: new mongoose.Types.ObjectId().toString(),
        taskId: new mongoose.Types.ObjectId().toString(),
        wbsId: new mongoose.Types.ObjectId().toString(),
        projectId: new mongoose.Types.ObjectId().toString(),
      };

      const req = {
        body: {
          userId: ids.userId,
          taskId: ids.taskId,
          oldTask: { wbsId: ids.wbsId, name: 'Old Task' },
          newTask: { name: 'New Task' },
        },
      };
      mockRes.status.mockClear();
      mockRes.send.mockClear();

      userProfile.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ firstName: 'John', lastName: 'Doe' }),
      });
      wbs.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ projectId: ids.projectId }),
      });
      const projectMembers = [
        { _id: 'm1', firstName: 'A', lastName: 'X', profilePic: 'a.png' },
        { _id: 'm2', firstName: 'B', lastName: 'Y', profilePic: 'b.png' },
      ];
      const { sort } = mockFindWithSort(projectMembers);

      const upsertResult = { ok: 1, value: { _id: 'tes1' } };
      TaskEditSuggestion.findOneAndUpdate.mockResolvedValue(upsertResult);

      const response = await createOrUpdateTaskEditSuggestion(req, mockRes);
      await flushPromises();

      assertResMock(200, upsertResult, response, mockRes);

      expect(userProfile.findById).toHaveBeenCalledTimes(1);
      expect(wbs.findById).toHaveBeenCalledTimes(1);
      expect(userProfile.find).toHaveBeenCalledWith(
        { projects: new mongoose.Types.ObjectId(ids.projectId) },
        '_id firstName lastName profilePic',
      );
      expect(sort).toHaveBeenCalledWith({ firstName: 1, lastName: 1 });

      const [queryArg, updateArg, optionsArg] = TaskEditSuggestion.findOneAndUpdate.mock.calls[0];

      expect(String(queryArg.taskId)).toBe(String(ids.taskId));
      expect(updateArg).toMatchObject({
        userId: ids.userId,
        user: 'John Doe',
        taskId: ids.taskId,
        wbsId: ids.wbsId,
        projectId: ids.projectId,
        oldTask: req.body.oldTask,
        newTask: req.body.newTask,
        projectMembers,
      });
      expect(optionsArg).toEqual({
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        rawResult: true,
      });
    });

    test('should return 400 when a dependency rejects', async () => {
      const TaskEditSuggestion = {
        findOneAndUpdate: jest.fn(),
      };
      const { createOrUpdateTaskEditSuggestion } = makeSut(TaskEditSuggestion);

      const req = {
        body: {
          userId: new mongoose.Types.ObjectId().toString(),
          taskId: new mongoose.Types.ObjectId().toString(),
          oldTask: { wbsId: new mongoose.Types.ObjectId().toString() },
          newTask: {},
        },
      };

      mockRes.status.mockClear();
      mockRes.send.mockClear();

      userProfile.findById.mockReturnValueOnce({
        select: jest.fn().mockRejectedValue(new Error('DB down')),
      });

      const response = await createOrUpdateTaskEditSuggestion(req, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      const sent = mockRes.send.mock.calls[0][0];
      expect(sent).toBeInstanceOf(Error);
      expect(sent.message).toContain('DB down');
      expect(response).toBeUndefined();
    });
  });

  describe('findAllTaskEditSuggestions()', () => {
    test('should return 200 with {count} when query.count=true', async () => {
      const TaskEditSuggestion = {
        countDocuments: jest.fn().mockResolvedValue(7),
        find: jest.fn(),
      };
      const { findAllTaskEditSuggestions } = makeSut(TaskEditSuggestion);

      const req = { query: { count: 'true' } };
      mockRes.status.mockClear();
      mockRes.send.mockClear();

      const response = await findAllTaskEditSuggestions(req, mockRes);
      await flushPromises();

      assertResMock(200, { count: 7 }, response, mockRes);
      expect(TaskEditSuggestion.countDocuments).toHaveBeenCalledTimes(1);
    });

    test('should return 200 with list when query.count is not true', async () => {
      const list = [{ _id: 1 }, { _id: 2 }];
      const TaskEditSuggestion = {
        countDocuments: jest.fn(),
        find: jest.fn().mockResolvedValue(list),
      };
      const { findAllTaskEditSuggestions } = makeSut(TaskEditSuggestion);

      const req = { query: {} };
      mockRes.status.mockClear();
      mockRes.send.mockClear();

      const response = await findAllTaskEditSuggestions(req, mockRes);
      await flushPromises();

      assertResMock(200, list, response, mockRes);
      expect(TaskEditSuggestion.find).toHaveBeenCalledTimes(1);
    });

    test('should return 400 when find() rejects', async () => {
      const error = new Error('boom');
      const TaskEditSuggestion = {
        find: jest.fn().mockRejectedValue(error),
        countDocuments: jest.fn(),
      };
      const { findAllTaskEditSuggestions } = makeSut(TaskEditSuggestion);

      const req = { query: {} };

      const response = await findAllTaskEditSuggestions(req, mockRes);
      await flushPromises();

      assertResMock(400, error, response, mockRes);
    });
  });

  describe('deleteTaskEditSuggestion()', () => {
    test('should return 200 when deletedCount === 1', async () => {
      const TaskEditSuggestion = {
        deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      };
      const { deleteTaskEditSuggestion } = makeSut(TaskEditSuggestion);

      const req = { param: { taskEditSuggestionId: 'abc123' } };
      mockRes.status.mockClear();
      mockRes.send.mockClear();

      const response = await deleteTaskEditSuggestion(req, mockRes);
      await flushPromises();

      expect(TaskEditSuggestion.deleteOne).toHaveBeenCalledWith('abc123');
      assertResMock(
        200,
        { message: 'Deleted task edit suggestion with _id: abc123' },
        response,
        mockRes,
      );
    });

    test('should return 400 when deletedCount !== 1', async () => {
      const TaskEditSuggestion = {
        deleteOne: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      };
      const { deleteTaskEditSuggestion } = makeSut(TaskEditSuggestion);

      const req = { param: { taskEditSuggestionId: 'abc123' } };

      const response = await deleteTaskEditSuggestion(req, mockRes);
      await flushPromises();

      assertResMock(
        400,
        { message: 'Failed to delete task edit suggestion with _id: abc123' },
        response,
        mockRes,
      );
    });

    test('should return 400 when deleteOne rejects', async () => {
      const err = new Error('delete failed');
      const TaskEditSuggestion = {
        deleteOne: jest.fn().mockRejectedValue(err),
      };
      const { deleteTaskEditSuggestion } = makeSut(TaskEditSuggestion);

      const req = { param: { taskEditSuggestionId: 'abc123' } };

      const response = await deleteTaskEditSuggestion(req, mockRes);
      await flushPromises();

      assertResMock(400, err, response, mockRes);
    });
  });
});
