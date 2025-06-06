const notificationController = require('./notificationController');
const Notification = require('../models/notification');
const notificationService = require('../services/notificationService');
const { mockReq, mockRes, assertResMock } = require('../test');

const makeSut = () => {
  const {
    getUserNotifications,
    getUnreadUserNotifications,
    getSentNotifications,
    createUserNotification,
    deleteUserNotification,
    markNotificationAsRead,
  } = notificationController(Notification);

  return {
    getUserNotifications,
    getUnreadUserNotifications,
    getSentNotifications,
    createUserNotification,
    deleteUserNotification,
    markNotificationAsRead,
  };
};

describe('Notification controller Unit Tests', () => {
  beforeEach(() => {
    mockReq.params.userId = '65cf6c3706d8ac105827bb2e';
    mockReq.body.requestor.role = 'Administrator';
    mockReq.body.requestor = {
      requestorId: '65cf6c3706d8ac105827bb2e',
      role: 'Administrator',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserNotifications', () => {
    test('Ensures getUserNotifications returns error 400 if userId is not provided', async () => {
      const { getUserNotifications } = makeSut();
      const errorMsg = { error: 'User ID is required' };
      mockReq.params.userId = '';
      const response = await getUserNotifications(mockReq, mockRes);
      assertResMock(400, errorMsg, response, mockRes);
    });
    test('Ensures getUserNotifications returns error 403 if userId does not match requestorId', async () => {
      const { getUserNotifications } = makeSut();
      const errorMsg = { error: 'Unauthorized request' };
      mockReq.body.requestor.requestorId = 'differentUserId';
      const response = await getUserNotifications(mockReq, mockRes);
      assertResMock(403, errorMsg, response, mockRes);
    });
    test('Ensures getUserNotifications returns 200 and notifications data when notifications are fetched successfully', async () => {
      const { getUserNotifications } = makeSut();
      const mockNotifications = [
        { id: '123', message: 'Notification Test 1' },
        { id: '123', message: 'Notification Test 2' },
        { id: '123', message: 'Notification Test 3' },
      ];
      const mockService = jest.fn().mockResolvedValue(mockNotifications);
      notificationService.getNotifications = mockService;
      const response = await getUserNotifications(mockReq, mockRes);
      assertResMock(200, mockNotifications, response, mockRes);
    });
    test('Ensures getUserNotifications returns error 500 if there is an internal error while fetching notifications.', async () => {
      const { getUserNotifications } = makeSut();
      const errorMsg = { error: 'Internal Error' };
      const mockService = jest.fn().mockRejectedValue(errorMsg);
      notificationService.getNotifications = mockService;
      const response = await getUserNotifications(mockReq, mockRes);
      assertResMock(500, errorMsg, response, mockRes);
    });
  });

  describe('getUnreadUserNotifications', () => {
    test('Ensures getUnreadUserNotifications returns error 400 if userId is not provided', async () => {
      const { getUnreadUserNotifications } = makeSut();
      const errorMsg = { error: 'User ID is required' };
      mockReq.params.userId = '';
      const response = await getUnreadUserNotifications(mockReq, mockRes);
      assertResMock(400, errorMsg, response, mockRes);
    });
    test('Ensures getUnreadUserNotifications returns error 403 if userId does not match requestorId', async () => {
      const { getUnreadUserNotifications } = makeSut();
      const errorMsg = { error: 'Unauthorized request' };
      mockReq.body.requestor.requestorId = 'differentUserId';
      const response = await getUnreadUserNotifications(mockReq, mockRes);
      assertResMock(403, errorMsg, response, mockRes);
    });
    test('Ensures getUnreadUserNotifications returns 200 and notifications data when notifications are fetched successfully', async () => {
      const { getUnreadUserNotifications } = makeSut();
      const mockNotifications = [
        { id: '123', message: 'Notification Test 1' },
        { id: '123', message: 'Notification Test 2' },
        { id: '123', message: 'Notification Test 3' },
      ];
      const mockService = jest.fn().mockResolvedValue(mockNotifications);
      notificationService.getUnreadUserNotifications = mockService;
      const response = await getUnreadUserNotifications(mockReq, mockRes);
      assertResMock(200, mockNotifications, response, mockRes);
    });
    test('Ensures getUnreadUserNotifications returns error 500 if there is an internal error while fetching notifications.', async () => {
      const { getUnreadUserNotifications } = makeSut();
      const errorMsg = { error: 'Internal Error' };
      const mockService = jest.fn().mockRejectedValue(errorMsg);
      notificationService.getUnreadUserNotifications = mockService;
      const response = await getUnreadUserNotifications(mockReq, mockRes);
      assertResMock(500, errorMsg, response, mockRes);
    });
  });
  describe('getSentNotifications', () => {
    test('Ensures getSentNotifications returns error 403 if requestor role is neither Administrator or Owner', async () => {
      const { getSentNotifications } = makeSut();
      const errorMsg = { error: 'Unauthorized request' };
      mockReq.body.requestor.role = 'randomRole';
      const response = await getSentNotifications(mockReq, mockRes);
      assertResMock(403, errorMsg, response, mockRes);
    });
    test('Ensures getSentNotifications returns 200 and notifications data when notifications are fetched successfully', async () => {
      const { getSentNotifications } = makeSut();
      const mockNotifications = [];
      const mockService = jest.fn().mockResolvedValue(mockNotifications);
      notificationService.getSentNotifications = mockService;
      const response = await getSentNotifications(mockReq, mockRes);
      assertResMock(200, mockNotifications, response, mockRes);
    });

    test('Ensures getSentNotification returns error 500 if there is an internal error while fetching notifications.', async () => {
      const { getSentNotifications } = makeSut();
      const errorMsg = { error: 'Internal Error' };
      const mockService = jest.fn().mockRejectedValue(errorMsg);
      notificationService.getSentNotifications = mockService;
      const response = await getSentNotifications(mockReq, mockRes);
      assertResMock(500, errorMsg, response, mockRes);
    });
  });
  describe('createUserNotification', () => {
    test('Ensures createUserNotification returns error 403 when requestor role is not Admin or Owner', async () => {
      const { createUserNotification } = makeSut();
      const errorMsg = { error: 'Unauthorized request' };
      mockReq.body.requestor.role = 'randomRole';
      mockReq.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
      };
      const response = await createUserNotification(mockReq, mockRes);
      assertResMock(403, errorMsg, response, mockRes);
    });
    test('Ensures createUserNotification returns error 400 if message or recipient is missing', async () => {
      const { createUserNotification } = makeSut();
      const errorMsg = { error: 'Message and recipient are required' };
      mockReq.body = {
        requestor: {
          role: 'Administrator',
        },
        message: '',
        recipient: '',
      };
      const response = await createUserNotification(mockReq, mockRes);
      assertResMock(400, errorMsg, response, mockRes);
    });
    test('Ensures createUserNotification returns 200 and notification data when notification is created successfully', async () => {
      const { createUserNotification } = makeSut();
      const mockNotification = {
        message: 'Notification Test',
        recipient: '65cf6c3706d8ac105827bb2e',
        sender: '5a7e21f00317bc1538def4b7',
      };
      mockReq.body = {
        requestor: {
          role: 'Administrator',
        },
        message: 'Notification Test',
        recipient: '65cf6c3706d8ac105827bb2e',
      };
      mockReq.requestor = {
        requestorId: '5a7e21f00317bc1538def4b7',
      };

      const mockService = jest.fn().mockResolvedValue(mockNotification);
      notificationService.createNotification = mockService;

      await createUserNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockNotification);
      expect(mockService).toHaveBeenCalledWith(
        mockReq.requestor.requestorId,
        mockReq.body.recipient,
        mockReq.body.message,
      );
    });
    test('Ensures createUserNotification returns error 500 if there is an internal error while creating a notification.', async () => {
      const { createUserNotification } = makeSut();
      mockReq.body.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
        role: 'Administrator',
      };
      notificationService.createNotification = jest
        .fn()
        .mockRejectedValue({ error: 'Internal Error' });
      await createUserNotification(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Internal Error' });
    });
  });
  describe('deleteUserNotification', () => {
    test('Ensures deleteUserNotification returns error 403 when requestor role is not Admin or Owner', async () => {
      const { deleteUserNotification } = makeSut();
      mockReq.body.requestor.role = 'randomRole';
      await deleteUserNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Unauthorized request' });
    });
    test('Ensures deleteUserNotification returns 200 and deletes notification', async () => {
      const { deleteUserNotification } = makeSut();
      const mockNotification = {
        message: 'Notification Test',
        recipient: '65cf6c3706d8ac105827bb2e',
        sender: '5a7e21f00317bc1538def4b7',
      };
      mockReq.body = {
        requestor: {
          role: 'Administrator',
        },
        message: 'Notification Test',
        recipient: '65cf6c3706d8ac105827bb2e',
      };
      mockReq.requestor = {
        requestorId: '5a7e21f00317bc1538def4b7',
      };

      const mockService = jest.fn().mockResolvedValue(mockNotification);
      notificationService.deleteNotification = mockService;

      await deleteUserNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockNotification);
      expect(mockService).toHaveBeenCalledWith(mockReq.params.notificationId);
    });
    test('Ensures deleteUserNotification returns error 500 if there is an internal error while deleting a notification.', async () => {
      const { deleteUserNotification } = makeSut();
      mockReq.body.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
        role: 'Administrator',
      };
      notificationService.deleteNotification = jest
        .fn()
        .mockRejectedValue({ error: 'Internal Error' });
      await deleteUserNotification(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Internal Error' });
    });
  });
  describe('markNotificationsAsRead', () => {
    test('Ensures markNotificationAsRead returns 400 if recipientId is missing', () => {
      const { markNotificationAsRead } = makeSut();
      mockReq.body.requestor.requestorId = '';
      markNotificationAsRead(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Recipient ID is required' });
    });
    test('Ensures markNotificationAsRead returns 200 and marks notification as read', async () => {
      const { markNotificationAsRead } = makeSut();
      const mockNotification = {
        message: 'Notification Test',
        recipient: '65cf6c3706d8ac105827bb2e',
        sender: '5a7e21f00317bc1538def4b7',
      };
      mockReq.body = {
        requestor: {
          role: 'Administrator',
        },
        message: 'Notification Test',
        recipient: '65cf6c3706d8ac105827bb2e',
      };
      mockReq.body.requestor = {
        requestorId: '5a7e21f00317bc1538def4b7',
      };
      mockReq.params = {
        notificationId: '12345',
      };

      const mockService = jest.fn().mockResolvedValue(mockNotification);
      notificationService.markNotificationAsRead = mockService;

      await markNotificationAsRead(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockNotification);
      expect(mockService).toHaveBeenCalledWith(
        mockReq.params.notificationId,
        mockReq.body.requestor.requestorId,
      );
    });
    test('Ensures markNotificationAsRead returns 500 if there is an internal error while marking notification as read.', async () => {
      const { markNotificationAsRead } = makeSut();
      mockReq.body.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
        role: 'Administrator',
      };
      notificationService.markNotificationAsRead = jest
        .fn()
        .mockRejectedValue({ error: 'Internal Error' });
      await markNotificationAsRead(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Internal Error' });
    });
  });
});
