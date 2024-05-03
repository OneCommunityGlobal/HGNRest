const notificationController = require('./notificationController');
const Notification = require('../models/notification');
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
      mockReq.params = { userId: '65cf6c3706d8ac105827bb2e' };
      mockReq.body = { requestor: { requestorId: 'differentUserId', role: 'Administrator' } };
      await getUserNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith({ error: 'Unauthorized request' });
    });
  });
});
