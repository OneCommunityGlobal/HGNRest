const mongoose = require('mongoose');
const { mockRes, assertResMock } = require('../test');

const flushPromises = () => new Promise(setImmediate);
const taskNotificationController = require('./taskNotificationController');

const makeSut = (TaskNotification) => {
  const {
    getUnreadTaskNotificationsByUser,
    deleteTaskNotification,
    createOrUpdateTaskNotification,
    markTaskNotificationAsRead,
    deleteTaskNotificationByUserId,
  } = taskNotificationController(TaskNotification);

  return {
    getUnreadTaskNotificationsByUser,
    deleteTaskNotification,
    createOrUpdateTaskNotification,
    markTaskNotificationAsRead,
    deleteTaskNotificationByUserId,
  };
};

describe('Unit Tests for taskNotificationController.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRes.status.mockClear();
    mockRes.send.mockClear();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('getUnreadTaskNotificationsByUser()', () => {
    test('returns 200 with results when find resolves', async () => {
      const results = [{ _id: 'n1' }, { _id: 'n2' }];
      const TaskNotification = {
        find: jest.fn().mockResolvedValue(results),
      };
      const { getUnreadTaskNotificationsByUser } = makeSut(TaskNotification);

      const req = { params: { userId: 'u123' } };

      const response = await getUnreadTaskNotificationsByUser(req, mockRes);
      await flushPromises();

      assertResMock(200, results, response, mockRes);
      expect(TaskNotification.find).toHaveBeenCalledWith({ recipient: 'u123', isRead: false });
    });

    test('returns 400 when find rejects', async () => {
      const err = new Error('db error');
      const TaskNotification = {
        find: jest.fn().mockRejectedValue(err),
      };
      const { getUnreadTaskNotificationsByUser } = makeSut(TaskNotification);

      const req = { params: { userId: 'u123' } };

      const response = await getUnreadTaskNotificationsByUser(req, mockRes);
      await flushPromises();

      assertResMock(400, err, response, mockRes);
    });
  });

  describe('createOrUpdateTaskNotification()', () => {
    test('returns 200 when updateOne resolves for all userIds (non-empty)', async () => {
      const TaskNotification = {
        updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      };
      const { createOrUpdateTaskNotification } = makeSut(TaskNotification);

      const tid = new mongoose.Types.ObjectId().toString();
      const u1 = new mongoose.Types.ObjectId().toString();
      const u2 = new mongoose.Types.ObjectId().toString();

      const req = {
        params: { taskId: tid },
        body: { userIds: [u1, u2], oldTask: { name: 'old' } },
      };

      const response = await createOrUpdateTaskNotification(req, mockRes);
      await flushPromises();

      assertResMock(200, { message: 'Create or updated task notification' }, response, mockRes);
      expect(TaskNotification.updateOne).toHaveBeenCalledTimes(2);

      const asObjId = (id) => new mongoose.Types.ObjectId(id);

      expect(TaskNotification.updateOne).toHaveBeenNthCalledWith(
        1,
        {
          $and: [{ taskId: asObjId(tid) }, { userId: asObjId(u1) }],
        },
        { $setOnInsert: { oldTask: { name: 'old' } } },
        { upsert: true, setDefaultsOnInsert: true },
      );
      expect(TaskNotification.updateOne).toHaveBeenNthCalledWith(
        2,
        {
          $and: [{ taskId: asObjId(tid) }, { userId: asObjId(u2) }],
        },
        { $setOnInsert: { oldTask: { name: 'old' } } },
        { upsert: true, setDefaultsOnInsert: true },
      );
    });

    test('returns 200 when userIds is empty (no-op Promise.all)', async () => {
      const TaskNotification = {
        updateOne: jest.fn(),
      };
      const { createOrUpdateTaskNotification } = makeSut(TaskNotification);

      const tid = new mongoose.Types.ObjectId().toString();
      const req = {
        params: { taskId: tid },
        body: { userIds: [], oldTask: { any: 'thing' } },
      };

      const response = await createOrUpdateTaskNotification(req, mockRes);
      await flushPromises();

      assertResMock(200, { message: 'Create or updated task notification' }, response, mockRes);
      expect(TaskNotification.updateOne).not.toHaveBeenCalled();
    });

    test('returns 400 when updateOne rejects for any userId', async () => {
      const TaskNotification = {
        updateOne: jest
          .fn()
          .mockResolvedValueOnce({})
          .mockRejectedValueOnce(new Error('upsert failed')),
      };
      const { createOrUpdateTaskNotification } = makeSut(TaskNotification);

      const tid = new mongoose.Types.ObjectId().toString();
      const u1 = new mongoose.Types.ObjectId().toString();
      const u2 = new mongoose.Types.ObjectId().toString();

      const req = {
        params: { taskId: tid },
        body: { userIds: [u1, u2], oldTask: { name: 'old' } },
      };

      const response = await createOrUpdateTaskNotification(req, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      const payload = mockRes.send.mock.calls.at(-1)[0];
      expect(payload).toBeInstanceOf(Error);
      expect(String(payload.message)).toContain('upsert failed');
      expect(response).toBeUndefined();
    });
  });

  describe('deleteTaskNotification()', () => {
    test('returns 200 when findById resolves and remove resolves', async () => {
      const resultDoc = {
        remove: jest.fn().mockResolvedValue(true),
      };
      const TaskNotification = {
        findById: jest.fn().mockResolvedValue(resultDoc),
      };
      const { deleteTaskNotification } = makeSut(TaskNotification);

      const req = { params: { taskNotificationId: 'nid123' } };

      const response = await deleteTaskNotification(req, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        message: 'Deleted task notification',
        result: resultDoc,
      });
      expect(TaskNotification.findById).toHaveBeenCalledWith('nid123');
      expect(resultDoc.remove).toHaveBeenCalled();
      expect(response).toBeUndefined();
    });

    test('returns 400 when remove rejects', async () => {
      const err = new Error('remove failed');
      const resultDoc = {
        remove: jest.fn().mockRejectedValue(err),
      };
      const TaskNotification = {
        findById: jest.fn().mockResolvedValue(resultDoc),
      };
      const { deleteTaskNotification } = makeSut(TaskNotification);

      const req = { params: { taskNotificationId: 'nid123' } };

      const response = await deleteTaskNotification(req, mockRes);
      await flushPromises();

      assertResMock(400, err, response, mockRes);
      expect(TaskNotification.findById).toHaveBeenCalledWith('nid123');
      expect(resultDoc.remove).toHaveBeenCalled();
    });

    test('returns 400 when findById rejects', async () => {
      const err = new Error('findById failed');
      const TaskNotification = {
        findById: jest.fn().mockRejectedValue(err),
      };
      const { deleteTaskNotification } = makeSut(TaskNotification);

      const req = { params: { taskNotificationId: 'nid123' } };

      const response = await deleteTaskNotification(req, mockRes);
      await flushPromises();

      assertResMock(400, err, response, mockRes);
      expect(TaskNotification.findById).toHaveBeenCalledWith('nid123');
    });
  });

  describe('deleteTaskNotificationByUserId()', () => {
    // const makeChain = (execImpl) => {
    //     const chain = {
    //         populate: jest.fn().mockReturnThis(),
    //         exec: jest.fn(execImpl),
    //     };
    //     return chain;
    // };

    test('returns 200 when exec yields a result and remove resolves', async () => {
      const resultDoc = { remove: jest.fn().mockResolvedValue(true) };

      const TaskNotification = {
        findOne: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn((cb) => cb(null, resultDoc)),
        }),
      };
      const { deleteTaskNotificationByUserId } = makeSut(TaskNotification);

      const taskId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();

      const req = { params: { taskId, userId } };

      const response = await deleteTaskNotificationByUserId(req, mockRes);
      await flushPromises();

      expect(TaskNotification.findOne).toHaveBeenCalledWith({
        taskId: new mongoose.Types.ObjectId(taskId),
        userId: new mongoose.Types.ObjectId(userId),
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({ message: 'Deleted task notification' });
      expect(resultDoc.remove).toHaveBeenCalled();
      expect(response).toBeUndefined();
    });

    test('returns 400 when exec gets an error', async () => {
      const execError = new Error('aggregate exec error');

      const TaskNotification = {
        findOne: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn((cb) => cb(execError, null)),
        }),
      };
      const { deleteTaskNotificationByUserId } = makeSut(TaskNotification);

      const taskId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const req = { params: { taskId, userId } };

      const response = await deleteTaskNotificationByUserId(req, mockRes);
      await flushPromises();

      assertResMock(400, execError, response, mockRes);
      expect(TaskNotification.findOne).toHaveBeenCalled();
    });

    test('returns 400 when remove rejects', async () => {
      const remErr = new Error('remove failed');
      const resultDoc = { remove: jest.fn().mockRejectedValue(remErr) };

      const TaskNotification = {
        findOne: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn((cb) => cb(null, resultDoc)),
        }),
      };
      const { deleteTaskNotificationByUserId } = makeSut(TaskNotification);

      const taskId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const req = { params: { taskId, userId } };

      const response = await deleteTaskNotificationByUserId(req, mockRes);
      await flushPromises();

      assertResMock(400, remErr, response, mockRes);
      expect(resultDoc.remove).toHaveBeenCalled();
    });
  });

  describe('markTaskNotificationAsRead()', () => {
    test('returns 200 when found, sets fields, and save resolves', async () => {
      const doc = {
        isRead: false,
        dateRead: null,
        save: jest.fn().mockResolvedValue({ isRead: true, dateRead: 123 }),
      };
      const TaskNotification = {
        findById: jest.fn().mockResolvedValue(doc),
      };
      const { markTaskNotificationAsRead } = makeSut(TaskNotification);

      const req = { params: { notificationId: 'n123' } };

      const response = await markTaskNotificationAsRead(req, mockRes);
      await flushPromises();

      assertResMock(200, { isRead: true, dateRead: 123 }, response, mockRes);
      expect(TaskNotification.findById).toHaveBeenCalledWith('n123');
      expect(doc.isRead).toBe(true);
      expect(typeof doc.dateRead).toBe('number');
      expect(doc.save).toHaveBeenCalled();
    });

    test('returns 404 when document is not found', async () => {
      const TaskNotification = {
        findById: jest.fn().mockResolvedValue(null),
      };
      const { markTaskNotificationAsRead } = makeSut(TaskNotification);

      const req = { params: { notificationId: 'n404' } };

      const response = await markTaskNotificationAsRead(req, mockRes);
      await flushPromises();

      assertResMock(404, 'TaskNotification not found.', response, mockRes);
    });

    test('returns 400 when save rejects', async () => {
      const err = new Error('save failed');
      const doc = {
        isRead: false,
        dateRead: null,
        save: jest.fn().mockRejectedValue(err),
      };
      const TaskNotification = {
        findById: jest.fn().mockResolvedValue(doc),
      };
      const { markTaskNotificationAsRead } = makeSut(TaskNotification);

      const req = { params: { notificationId: 'n123' } };

      const response = await markTaskNotificationAsRead(req, mockRes);
      await flushPromises();

      assertResMock(400, err, response, mockRes);
      expect(doc.save).toHaveBeenCalled();
    });

    test('returns 400 when findById rejects', async () => {
      const err = new Error('lookup failed');
      const TaskNotification = {
        findById: jest.fn().mockRejectedValue(err),
      };
      const { markTaskNotificationAsRead } = makeSut(TaskNotification);

      const req = { params: { notificationId: 'n123' } };

      const response = await markTaskNotificationAsRead(req, mockRes);
      await flushPromises();

      assertResMock(400, err, response, mockRes);
    });
  });
});
