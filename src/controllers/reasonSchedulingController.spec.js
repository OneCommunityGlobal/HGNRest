const moment = require('moment-timezone');
const { postReason } = require('./reasonSchedulingController');
const { mockReq, mockRes, mockUser } = require('../test');
const UserModel = require('../models/userProfile');
//  assertResMock
const ReasonModel = require('../models/reason');

jest.mock('../utilities/emailSender');

// const emailSender = require('../utilities/emailSender');

// Mock the models
jest.mock('../models/reason');
jest.mock('../models/userProfile');

const flushPromises = () => new Promise(setImmediate);

function mockDay(dayIdx, past = false) {
  const date = moment().tz('America/Los_Angeles').startOf('day');
  while (date.day() !== dayIdx) {
    date.add(past ? -1 : 1, 'days');
  }
  return date;
}

describe('reasonScheduling Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRes.json = jest.fn();
    mockReq.body = {
      ...mockReq.body,
      ...mockUser(),
      reasonData: {
        date: mockDay(0),
        message: 'some reason',
      },
      currentDate: moment.tz('America/Los_Angeles').startOf('day'),
    };
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('postReason method', () => {
    test('Ensure postReason returns 400 for warning to choose Sunday', async () => {
      mockReq.body.reasonData.date = mockDay(1, true);
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
    test('Ensure postReason returns 400 for warning to choose a future date', async () => {
      mockReq.body.reasonData.date = mockDay(0, true);
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
      const mockFindUser = jest.spyOn(UserModel, 'findById').mockImplementationOnce(() => null);

      await postReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.userId);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        }),
      );
    });
    test('Ensure postReason returns 403 when duplicate reason to the date', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());
      jest.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValueOnce({
        _id: mockReq.body.userId,
        timeOffFrom: mockReq.body.currentDate,
        timeOffTill: mockReq.body.reasonData.date,
      });
      const mockReason = {
        reason: 'Some Reason',
        userId: mockReq.userId,
        date: moment.tz('America/Los_Angeles').startOf('day').toISOString(),
      };

      jest.spyOn(ReasonModel, 'findOne').mockResolvedValue(mockReason);

      await postReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.body.userId);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'The reason must be unique to the date',
          errorCode: 3,
        }),
      );
    });
    test('Ensure postReason returns 400 when any error in saving.', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());
      jest.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValueOnce({
        _id: mockReq.body.userId,
        timeOffFrom: mockReq.body.currentDate,
        timeOffTill: mockReq.body.reasonData.date,
      });
      mockRes.sendStatus = jest.fn().mockReturnThis();
      const newReason = {
        reason: mockReq.body.reasonData.message,
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.body.userId,
      };

      jest.spyOn(ReasonModel, 'findOne').mockResolvedValue();
      const mockSave = jest.spyOn(ReasonModel.prototype, 'save').mockRejectedValue(newReason);

      await postReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.body.userId);
      expect(mockSave).toHaveBeenCalledWith();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errMessage: 'Something went wrong',
        }),
      );
    });
    test('Ensure postReason returns 200 if schedule reason and send blue sqaure email successfully', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());
      jest.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValueOnce({
        _id: mockReq.body.userId,
        timeOffFrom: mockReq.body.currentDate,
        timeOffTill: mockReq.body.reasonData.date,
      });
      mockRes.sendStatus = jest.fn().mockReturnThis();
      const newReason = {
        reason: mockReq.body.reasonData.message,
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.body.userId,
      };
      // const subject = `Blue Square Reason for ${mockFindUser.firstName} ${mockFindUser.lastName} has been set`;

      // const emailBody = `<p> Hi ! </p>

      //     <p>This email is to let you know that ${mockFindUser.firstName} ${mockFindUser.lastName} has set their Blue Square Reason.</p>

      //     <p>Blue Square Reason : ${newReason.reason} </p>
      //     <p>Scheduled date for the Blue Square Reason: : ${newReason.date}  </p>

      //     <p>Thank you,<br />
      //     One Community</p>`;

      jest.spyOn(ReasonModel, 'findOne').mockResolvedValue();
      const mockSave = jest.spyOn(ReasonModel.prototype, 'save').mockResolvedValue(newReason);

      await postReason(mockReq, mockRes);
      await flushPromises();
      // emailSender.mockImplementation(() => Promise.resolve(true));
      expect(mockRes.sendStatus).toHaveBeenCalledWith(200);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.body.userId);
      expect(mockSave).toHaveBeenCalledWith();
      // expect(emailSender).toHaveBeenCalledWith();
    });
  });
});
