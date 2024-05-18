const {
  mockReq,
  mockRes,
  mockUser,
  assertResMock,
  mongoHelper: { dbConnect, dbDisconnect },
} = require('../test');
const TaskNotification = require('../models/taskNotification');
const taskNotificationController = require('./taskNotificationController');

const makeSut = () => {
  const {
    getUnreadTaskNotificationsByUser,
    createOrUpdateTaskNotification,
    deleteTaskNotification,
    deleteTaskNotificationByUserId,
    markTaskNotificationAsRead,
  } = taskNotificationController();
  return {
    getUnreadTaskNotificationsByUser,
    createOrUpdateTaskNotification,
    deleteTaskNotification,
    deleteTaskNotificationByUserId,
    markTaskNotificationAsRead,
  };
};

describe('taskNotificationController module', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUnreadTaskNotificationsByUser', () => {
    test('Ensure getUnreadTaskNotificationsByUser returns unread task notifications for a user', async () => {
      mockReq.params.userId = '123456';
      const mockTaskNotifications = [
        { _id: '1', recipient: '123456', isRead: false },
        { _id: '2', recipient: '123456', isRead: false },
      ];

      jest
        .spyOn(TaskNotification, 'findOne')
        .mockImplementation(() => Promise.resolve(mockTaskNotifications));

        const res = await taskNotificationController.getUnreadTaskNotificationsByUser(mockReq, mockRes);
        assertResMock(200, mockTaskNotifications, res, mockRes);

    });

    test('Ensure getUnreadTaskNotificationsByUser catches errors when returning unread task notifications', () => {});
  });

  describe('createOrUpdateTaskNotification', () => {
    test('Ensure createOrUpdateTaskNotification creates or updates task notifications', () => {});

    test('Ensure getUnreadTaskNotificationsByUser catches errors when creating or updating task notifications', () => {});
  });

  describe('deleteTaskNotification', () => {
    test('Ensure deleteTaskNotification deletes a task notification', () => {});

    test('Ensure deleteTaskNotification catches errors when deleting a task notification', () => {});
  });

  describe('deleteTaskNotificationByUserId', () => {
    test('Ensure deleteTaskNotificationByUserId deletes a task notification by userId', () => {});

    test('Ensure deleteTaskNotificationByUserId catches errors when deletes a task notification by userId', () => {});
  });

  describe('markTaskNotificationAsRead', () => {
    test('Ensure markTaskNotificationAsRead marks a task notification as read', () => {});

    test('Ensure markTaskNotificationAsRead returns 404 if TaskNotification not found', () => {});
  });
});
