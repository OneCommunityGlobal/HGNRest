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
  } = taskNotificationController(TaskNotification);
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
    test.only('Ensure getUnreadTaskNotificationsByUser returns unread task notifications for a user', async () => {

      const {getUnreadTaskNotificationsByUser} = makeSut();
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

    test('Ensure getUnreadTaskNotificationsByUser catches errors when returning unread task notifications',async  () => {
      const {getUnreadTaskNotificationsByUser} = makeSut();
      mockReq.params.userId = '123456';
      const error = new Error('Something went wrong');
      const findOneSpy = jest
      .spyOn(TaskNotification, 'find')
      .mockImplementation(() => Promise.resolve(false));
      jest.spyOn(TaskNotification, 'find').mockRejectedValue(error);

      const response = await getUnreadTaskNotificationsByUser(mockReq, mockRes);
        assertResMock(400, error, response, mockRes);
    });
  });

  describe('createOrUpdateTaskNotification', () => {
    test('Ensure createOrUpdateTaskNotification creates or updates task notifications', () => {});

    test('Ensure getUnreadTaskNotificationsByUser catches errors when creating or updating task notifications', () => {});
  });

  describe.only('deleteTaskNotification', () => {
    test.only('Ensure deleteTaskNotification deletes a task notification', async () => {
      const {deleteTaskNotification} = makeSut();
      mockReq.params.taskNotificationId = '123456';

      const mockTaskNotification = {
        remove: jest.fn(() => Promise.resolve())
      };

      jest.spyOn(TaskNotification, 'findById').mockResolvedValue(mockTaskNotification);

      const response = await deleteTaskNotification(mockReq, mockRes);

      expect(mockTaskNotification.remove).toHaveBeenCalled();
      assertResMock(200, { message: 'Deleted task notification', result: mockTaskNotification }, response, mockRes);
    });

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
