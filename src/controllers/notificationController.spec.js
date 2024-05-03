const notificationController = require('./notificationController');
const Notification = require('../models/notification');
const notificationService = require('../services/notificationService');
const { mockReq, mockRes } = require('../test');

const makeSut = () => {
  const {
    getUserNotifications,
    getUnreadUserNotifications,
    getSentNotifications,
    createUserNotification,
  } = notificationController(Notification);

  return {
    getUserNotifications,
    getUnreadUserNotifications,
    getSentNotifications,
    createUserNotification,
  };
};

describe('Notification controller Unit Tests', () => {
  beforeEach(() => {
    mockReq.params.userId = '65cf6c3706d8ac105827bb2e';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserNotifications', () => {
    test('Ensures getUserNotifications returns error 400 if userId is not provided', async () => {
      const { getUserNotifications } = makeSut();
      mockReq.params.userId = '';
      await getUserNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'User ID is required' });
    });
    test('Ensures getUserNotifications returns error 403 if userId does not match requestorId', async () => {
      const { getUserNotifications } = makeSut();
      mockReq.body = { requestor: { requestorId: 'differentUserId', role: 'Administrator' } };
      await getUserNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Unauthorized request' });
    });
    test('Ensures getUserNotifications returns 200 and notifications data when notifications are fetched successfully', async () => {
      const { getUserNotifications } = makeSut();
      const mockNotifications = [
        { id: '123', message: 'Notification Test 1' },
        { id: '123', message: 'Notification Test 2' },
        { id: '123', message: 'Notification Test 3' },
      ];
      mockReq.body.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
        role: 'Administrator',
      };

      const mockService = jest.fn().mockResolvedValue(mockNotifications);

      notificationService.getNotifications = mockService;

      await getUserNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockNotifications);
      expect(mockService).toHaveBeenCalledWith(mockReq.params.userId);
    });
    test('Ensures getUserNotifications returns error 500 if there is an internal error while fetching notifications.', async () => {
      const { getUserNotifications } = makeSut();
      mockReq.body.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
        role: 'Administrator',
      };
      notificationService.getNotifications = jest
        .fn()
        .mockRejectedValue(new Error('Internal Error'));

      await getUserNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Internal Error' });
    });
  });

  describe('getUnreadUserNotifications', () => {
    test('Ensures getUnreadUserNotifications returns error 400 if userId is not provided', async () => {
      const { getUnreadUserNotifications } = makeSut();
      mockReq.params.userId = '';
      await getUnreadUserNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'User ID is required' });
    });
    test('Ensures getUnreadUserNotifications returns error 403 if userId does not match requestorId', async () => {
      const { getUnreadUserNotifications } = makeSut();
      mockReq.body = { requestor: { requestorId: 'differentUserId', role: 'Administrator' } };
      await getUnreadUserNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Unauthorized request' });
    });
    test('Ensures getUnreadUserNotifications returns 200 and notifications data when notifications are fetched successfully', async () => {
      const { getUnreadUserNotifications } = makeSut();
      const mockNotifications = [
        { id: '123', message: 'Notification Test 1' },
        { id: '123', message: 'Notification Test 2' },
        { id: '123', message: 'Notification Test 3' },
      ];
      mockReq.body.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
        role: 'Administrator',
      };

      const mockService = jest.fn().mockResolvedValue(mockNotifications);

      notificationService.getUnreadUserNotifications = mockService;

      await getUnreadUserNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockNotifications);
      expect(mockService).toHaveBeenCalledWith(mockReq.params.userId);
    });
    test('Ensures getUnreadUserNotifications returns error 500 if there is an internal error while fetching notifications.', async () => {
      const { getUnreadUserNotifications } = makeSut();
      mockReq.body.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
        role: 'Administrator',
      };
      notificationService.getUnreadUserNotifications = jest
        .fn()
        .mockRejectedValue(new Error('Internal Server Error'));
      await getUnreadUserNotifications(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Internal Error' });
    });
  });
  describe('getSentNotifications', () => {
    test('Ensures getSentNotifications returns error 403 if requestor role is neither Administrator or Owner', async () => {
      const { getSentNotifications } = makeSut();
      mockReq.body = { requestor: { role: 'randomRole' } };
      await getSentNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Unauthorized request' });
    });
    test('Ensures getSentNotifications returns 200 and notifications data when notifications are fetched successfully', async () => {
      const { getSentNotifications } = makeSut();
      const mockNotifications = [];
      mockReq.body.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
        role: 'Administrator',
      };

      const mockService = jest.fn().mockResolvedValue(mockNotifications);
      notificationService.getSentNotifications = mockService;

      await getSentNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockNotifications);
      expect(mockService).toHaveBeenCalledWith(mockReq.body.requestor.requestorId);
    });

    test('Ensures getSentNotifications returns error 500 if there is an internal error while fetching notifications.', async () => {
      const { getSentNotifications } = makeSut();
      mockReq.body.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
        role: 'Administrator',
      };
      notificationService.getSentNotifications = jest
        .fn()
        .mockRejectedValue(new Error('Internal Error'));
      await getSentNotifications(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Internal Error' });
    });
  });
  describe('createUserNotification', () => {
    test('Ensures createUserNotifications returns 403 when requestor role is not Admin or Owner', async () => {
      const { createUserNotification } = makeSut();
      mockReq.body.requestor = {
        role: 'randomRole',
      };
      mockReq.requestor = {
        requestorId: '65cf6c3706d8ac105827bb2e',
      };
      await createUserNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Unauthorized request' });
    });
    test('Ensures createUserNotifications returns 400 if message or recipient is missing', async () => {
      const { createUserNotification } = makeSut();
      mockReq.body = {
        requestor: {
          role: 'Administrator',
        },
        message: '',
        recipient: '',
      };
      await createUserNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Message and recipient are required' });
    });
  });
});
