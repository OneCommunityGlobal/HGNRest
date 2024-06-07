// const moment = require('moment-timezone');
const { postReason } = require('./reasonSchedulingController');
const { mockReq, mockRes } = require('../test');
const UserModel = require('../models/userProfile');
//  assertResMock
// const ReasonModel = require('../models/reason');
// const emailSender = require('../utilities/emailSender');

// Mock the models
jest.mock('../models/reason');
jest.mock('../models/userProfile');

const flushPromises = () => new Promise(setImmediate);

describe('reasonScheduling Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRes.json = jest.fn();
    mockReq.body = {
      ...mockReq.body,
      userId: '5a7e21f00317bc1538def4b7',
      reasonData: {
        date: '2024-06-10T05:00:00.000Z',
        message: 'some reason',
      },
    };
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('postReason method', () => {
    test('Ensure postReason returns 400 for warning to choose Sunday', async () => {
      mockReq.body.reasonData.date = '2024-06-01T05:00:00.000Z';
      await postReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "You must choose the Sunday YOU'LL RETURN as your date. This is so your reason ends up as a note on that blue square.",
          errorCode: 0,
        }),
      );
    });
    test('Ensure postReason returns 400 for warning to choose a funture date', async () => {
      mockReq.body.reasonData.date = '2024-06-03T05:00:00.000Z';
      await postReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'You should select a date that is yet to come',
          errorCode: 7,
        }),
      );
    });
    test('Ensure postReason returns 400 for not providing reason', async () => {
      mockReq.body.reasonData.message = null;
      await postReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'You must provide a reason.',
          errorCode: 6,
        }),
      );
    });
    test('Ensure postReason returns 404 when error in finding user Id', async () => {
      const mockFindUser = jest.spyOn(UserModel, 'findById').mockReturnValue(null);
      await postReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.body.userId);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        }),
      );
    });
  });
});
