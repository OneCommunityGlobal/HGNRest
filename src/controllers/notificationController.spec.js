const notificationController = require('./notificationController');
const Notification = require('../models/notification');
const { mockReq, mockRes, assertResMock } = require('../test');

const makeSut = () => {
  const { getUserNotifications, createUserNotification, deleteUserNotification } =
    notificationController(Notification);

  return {
    getUserNotifications,
    createUserNotification,
    deleteUserNotification,
  };
};

const flushPromises = () => new Promise(setImmediate);

describe('Notification controller tests', () => {
  beforeEach(() => {
    mockReq.params.userId = '65cf6c3706d8ac105827bb2e';
    mockReq.params.notificationId = '507f191e810c19729de860ea';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserNotifications', () => {
    test('Ensures getUserNotifications returns 400 if userId is not valid', () => {
      const { getUserNotifications } = makeSut();
      mockReq.params.userId = 'invalidId';
      const response = getUserNotifications(mockReq, mockRes);
      assertResMock(400, { error: 'Bad Request' }, response, mockRes);
    });

    test('Ensures getUserNotifications returns 400 if userId is valid but finding user fails', async () => {
      const { getUserNotifications } = makeSut();
      jest
        .spyOn(Notification, 'find')
        .mockImplementationOnce(() => Promise.reject(new Error('error')));
      const response = getUserNotifications(mockReq, mockRes);
      await flushPromises();
      assertResMock(400, new Error('error'), response, mockRes);
    });

    test('Ensures getUserNotifications returns 200 with notifications for userId if it is valid and is found', async () => {
      const { getUserNotifications } = makeSut();
      const notifications = [];
      const findNotificationMock = jest
        .spyOn(Notification, 'find')
        .mockImplementationOnce(() => Promise.resolve(notifications));
      const response = getUserNotifications(mockReq, mockRes);
      await flushPromises();
      expect(findNotificationMock).toHaveBeenCalledWith(
        {
          recipient: '65cf6c3706d8ac105827bb2e',
        },
        '_id message eventType',
      );
      assertResMock(200, notifications, response, mockRes);
    });
  });

  describe('createUserNotification', () => {
    test('Ensures createUserNotification calls on save notification', async () => {
      const { createUserNotification } = makeSut();
      const mockNotification = {
        save: jest.fn().mockImplementationOnce(() => Promise.resolve(true)),
      };

      createUserNotification(mockNotification);
      await flushPromises();

      expect(mockNotification.save).toHaveBeenCalledWith();
    });
  });

  describe('deleteUserNotification', () => {
    test('Ensures deleteUserNotification returns 400 if notification ID is not valid', () => {
      const { deleteUserNotification } = makeSut();
      mockReq.params.notificationId = 'badnotificationId';
      const response = deleteUserNotification(mockReq, mockRes);
      assertResMock(400, { error: 'Bad request' }, response, mockRes);
    });

    test('Ensures deleteUserNotification returns 400 if any error occurs when finding a notification', async () => {
      const { deleteUserNotification } = makeSut();

      const errorMsg = 'Error occurred when finding notification';

      jest.spyOn(Notification, 'findById').mockImplementationOnce(() => Promise.reject(errorMsg));

      const response = deleteUserNotification(mockReq, mockRes);
      await flushPromises();
      assertResMock(400, errorMsg, response, mockRes);
    });
    test('Ensures deleteUserNotification returns 403 if recipient ID does match requestor ID', async () => {
      const { deleteUserNotification } = makeSut();
      mockReq.body.requestor.requestorId = '65cf6c3706d8ac105827bb2e';
      const mockNotification = {
        recipient: 'wrongrecipientId',
      };
      jest
        .spyOn(Notification, 'findById')
        .mockImplementationOnce(() => Promise.resolve(mockNotification));
      const response = deleteUserNotification(mockReq, mockRes);
      await flushPromises();
      assertResMock(403, { error: 'Unauthorized request' }, response, mockRes);
    });
    test('Ensures deleteUserNotification returns 200 if notification removal is successful', async () => {
      const { deleteUserNotification } = makeSut();
      const mockNotification = {
        recipient: '65cf6c3706d8ac105827bb2e',
        remove: jest.fn().mockResolvedValue({}),
      };
      jest
        .spyOn(Notification, 'findById')
        .mockImplementationOnce(() => Promise.resolve(mockNotification));
      const response = deleteUserNotification(mockReq, mockRes);
      await flushPromises();
      expect(mockNotification.remove).toHaveBeenCalled();
      assertResMock(200, { message: 'Deleted notification' }, response, mockRes);
    });
    test('Ensures deleteUserNotification returns 400 on failure to remove notification', async () => {
      const { deleteUserNotification } = makeSut();
      const errorMsg = 'Error occurred  when removing notification';
      const mockNotification = {
        recipient: '65cf6c3706d8ac105827bb2e',
        remove: jest.fn().mockRejectedValue(errorMsg),
      };
      jest
        .spyOn(Notification, 'findById')
        .mockImplementationOnce(() => Promise.resolve(mockNotification));
      const response = deleteUserNotification(mockReq, mockRes);
      await flushPromises();
      assertResMock(400, errorMsg, response, mockRes);
    });
  });
});
