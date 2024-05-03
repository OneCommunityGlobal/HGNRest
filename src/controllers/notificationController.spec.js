const notificationController = require('./notificationController');
const Notification = require('../models/notification');
const notificationService = require('../services/notificationService');
const { mockReq, mockRes } = require('../test');

const makeSut = () => {
  const { getUserNotifications } = notificationController(Notification);

  return {
    getUserNotifications,
  };
};

describe('Notification controller tests', () => {
  beforeEach(() => {
    mockReq.params.userId = '65cf6c3706d8ac105827bb2e';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Notification Controller Unit Tests', () => {
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
  });
});
