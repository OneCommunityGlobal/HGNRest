const {
  mockReq,
  mockRes,
  mockUser,
  assertResMock,
  mongoHelper: { dbConnect, dbDisconnect },
} = require('../test');
const TaskNotification = require('../models/taskNotification');
const taskNotificationController = require('./taskNotificationController');
const mongoose = require('mongoose');

const makeSut = () => {
  const {
    getUnreadTaskNotificationsByUser,
    createOrUpdateTaskNotification,
    deleteTaskNotification,
    deleteTaskNotificationByUserId,
    markTaskNotificationAsRead,
  } = taskNotificationController(TaskNotification);
  return {
    getUnreadTaskNotificationsByUser,
    createOrUpdateTaskNotification,
    deleteTaskNotification,
    deleteTaskNotificationByUserId,
    markTaskNotificationAsRead,
  };
};

//Forces promises to be resolved
const flushPromises = () => new Promise(setImmediate);

const createMockTaskNotification = (removeImplementation) => ({
  populate: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue({
    remove: jest.fn().mockImplementation(removeImplementation),
  }),
});

describe('taskNotificationController module', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUnreadTaskNotificationsByUser', () => {
    const { getUnreadTaskNotificationsByUser } = makeSut();
    test('Ensure getUnreadTaskNotificationsByUser returns unread task notifications for a user', async () => {
      
      mockReq.params.userId = '123456';
      const mockTaskNotifications = [
        { _id: '1', recipient: '123456', isRead: false },
        { _id: '2', recipient: '123456', isRead: false },
      ];
      jest
        .spyOn(TaskNotification, 'find')
        .mockImplementation(() => Promise.resolve(mockTaskNotifications));
      const response = await getUnreadTaskNotificationsByUser(mockReq, mockRes);
      assertResMock(200, mockTaskNotifications, response, mockRes);
    });

    test('Ensure getUnreadTaskNotificationsByUser catches errors when returning unread task notifications', async () => {
      mockReq.params.userId = '123456';
      const error = new Error('Something went wrong');
      const findSpy = jest.spyOn(TaskNotification, 'find').mockRejectedValueOnce(error);
      const response = await getUnreadTaskNotificationsByUser(mockReq, mockRes);
      await flushPromises();
      expect(findSpy).toHaveBeenCalledWith({ recipient: '123456', isRead: false });
      assertResMock(400, error, response, mockRes);
    });
  });

  describe('createOrUpdateTaskNotification', () => {
    const { createOrUpdateTaskNotification } = makeSut();
    beforeEach(() => {
      mockReq.params.taskId = new mongoose.Types.ObjectId();
      mockReq.params.userId = new mongoose.Types.ObjectId();
    });
    test('Ensure createOrUpdateTaskNotification creates or updates task notifications', async () => {
      mockReq.body = {
        oldTask: 'oldTaskData',
        userIds: [
          new mongoose.Types.ObjectId().toString(),
          new mongoose.Types.ObjectId().toString(),
        ],
      };
      jest.spyOn(TaskNotification, 'updateOne').mockResolvedValue({});
      const response = await createOrUpdateTaskNotification(mockReq, mockRes);
      expect(TaskNotification.updateOne).toHaveBeenCalledTimes(mockReq.body.userIds.length);
      mockReq.body.userIds.forEach((userId, index) => {
        expect(TaskNotification.updateOne).toHaveBeenNthCalledWith(
          index + 1,
          {
            $and: [
              { taskId: mongoose.Types.ObjectId(mockReq.params.taskId) },
              { userId: mongoose.Types.ObjectId(userId) },
            ],
          },
          {
            $setOnInsert: { oldTask: mockReq.body.oldTask },
          },
          {
            upsert: true,
            setDefaultsOnInsert: true,
          },
        );
      });

      assertResMock(200, { message: 'Create or updated task notification' }, response, mockRes);
    });

    test('Ensure getUnreadTaskNotificationsByUser catches errors when creating or updating task notifications', async () => {
      mockReq.body = {
        oldTask: 'oldTaskData',
        userIds: [
          new mongoose.Types.ObjectId().toString(),
          new mongoose.Types.ObjectId().toString(),
        ],
      };
      const error = new Error('Something went wrong');
      jest.spyOn(TaskNotification, 'updateOne').mockRejectedValue(error);
      const response = await createOrUpdateTaskNotification(mockReq, mockRes);
      await flushPromises();
      assertResMock(400, error, response, mockRes);
    });
  });

  describe('deleteTaskNotification', () => {
    const { deleteTaskNotification } = makeSut();
    beforeEach(() => {
      mockReq.params.taskId = new mongoose.Types.ObjectId();
      mockReq.params.userId = new mongoose.Types.ObjectId();
    });
    test('Ensure deleteTaskNotification deletes a task notification', async () => {
      
      
      const mockTaskNotification = {
        remove: jest.fn(() => Promise.resolve()),
      };
      jest.spyOn(TaskNotification, 'findById').mockResolvedValue(mockTaskNotification);
      const response = await deleteTaskNotification(mockReq, mockRes);
      expect(mockTaskNotification.remove).toHaveBeenCalled();
      assertResMock(
        200,
        { message: 'Deleted task notification', result: mockTaskNotification },
        response,
        mockRes,
      );
    });

    test('Ensure deleteTaskNotification catches errors when deleting a task notification during remove function', async () => {
      
      const errorDuringRemove = new Error('Error during removal');
      const mockTaskNotification = {
        remove: jest.fn().mockRejectedValueOnce(errorDuringRemove),
      };
      jest.spyOn(TaskNotification, 'findById').mockResolvedValueOnce(mockTaskNotification);

      const response = await deleteTaskNotification(mockReq, mockRes);
      await flushPromises();
      assertResMock(400, errorDuringRemove, response, mockRes);
    });

    test('Ensure deleteTaskNotification handles errors when the task notification is not found', async () => {
      const errorDuringFindById = new Error('Error during findById');
      jest.spyOn(TaskNotification, 'findById').mockRejectedValueOnce(errorDuringFindById);
      const response = await deleteTaskNotification(mockReq, mockRes);
      await flushPromises();
      assertResMock(400, errorDuringFindById, response, mockRes);
    });
  });

  describe('deleteTaskNotificationByUserId', () => {
    const { deleteTaskNotificationByUserId } = makeSut();
    beforeEach(() => {
      mockReq.params.taskId = new mongoose.Types.ObjectId();
      mockReq.params.userId = new mongoose.Types.ObjectId();
    });
    test('Ensure deleteTaskNotificationByUserId deletes a task notification by userId', async () => {
      const findOnePopulateObj = { populate: () => {} };
      const findOneSpy = jest
        .spyOn(TaskNotification, 'findOne')
        .mockImplementationOnce(() => findOnePopulateObj);

      const populateReturnObj = { populate: () => {} };
      jest.spyOn(findOnePopulateObj, 'populate').mockImplementationOnce(() => populateReturnObj);

      const secondPopulateObj = { exec: (err, result) => {} };
      jest.spyOn(populateReturnObj, 'populate').mockImplementationOnce(() => secondPopulateObj);

      const execReturnObj = { remove: () => {} };
      jest.spyOn(secondPopulateObj, 'exec').mockImplementationOnce((callback) => {
        callback(null, execReturnObj);
      });

      jest.spyOn(execReturnObj, 'remove').mockImplementationOnce(() => Promise.resolve(true));

      const res = await deleteTaskNotificationByUserId(mockReq, mockRes);
      await flushPromises();

      assertResMock(200, { message: 'Deleted task notification' }, res, mockRes);
      expect(findOneSpy).toHaveBeenCalledWith({
        taskId: mockReq.params.taskId,
        userId: mockReq.params.userId,
      });
    });

    // test('Ensure deleteTaskNotificationByUserId handles errors during exec function', async () => {

    // });

    // test('Ensure deleteTaskNotificationByUserId handles errors during remove', async () => {

    // });
  });

  describe('markTaskNotificationAsRead', () => {
    let mockNotification;
    const { markTaskNotificationAsRead } = makeSut();
    beforeEach(() => {
      mockNotification = {
        isRead: false,
        dateRead: null,
        save: jest.fn(),
      };
    });

    test('Ensure markTaskNotificationAsRead marks a task notification as read', async () => {
      mockNotification.save.mockResolvedValueOnce({
        ...mockNotification,
        isRead: true,
        dateRead: expect.any(Date),
      });
      jest.spyOn(TaskNotification, 'findById').mockResolvedValueOnce(mockNotification);
      const response = await markTaskNotificationAsRead(mockReq, mockRes);
      await flushPromises();
      assertResMock(
        200,
        { ...mockNotification, isRead: true, dateRead: expect.any(Date) },
        response,
        mockRes,
      );
    });

    test('Ensure markTaskNotificationAsRead returns 404 if TaskNotification not found', async () => {
      jest.spyOn(TaskNotification, 'findById').mockResolvedValueOnce(null);
      const response = await markTaskNotificationAsRead(mockReq, mockRes);
      await flushPromises();
      assertResMock(404, 'TaskNotification not found.', response, mockRes);
    });

    test('Ensure markTaskNotificationAsRead handles error during update', async () => {
      const errorDuringUpdate = new Error('Error during update');
      mockNotification.save.mockRejectedValueOnce(errorDuringUpdate);
      jest.spyOn(TaskNotification, 'findById').mockResolvedValueOnce(mockNotification);
      const response = await markTaskNotificationAsRead(mockReq, mockRes);
      await flushPromises();
      assertResMock(400, errorDuringUpdate, response, mockRes);
    });
  });
});
