const notificationController = require('./notificationController');
const Notification = require('../models/notification');
const { mockReq, mockRes, assertResMock } = require('../test');

const makeSut = () => {
  const { getUserNotifications } = notificationController(Notification);

  return {
    getUserNotifications,
  };
};

const flushPromises = () => new Promise(setImmediate);

describe('Notification controller tests', () => {
  beforeEach(() => {
    mockReq.params.userId = '65cf6c3706d8ac105827bb2e';
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
  });
});
