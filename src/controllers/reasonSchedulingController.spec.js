const moment = require('moment-timezone');
const { mockReq, mockRes, mockUser } = require('../test');
const UserModel = require('../models/userProfile');
const ReasonModel = require('../models/reason');


jest.mock('../utilities/emailSender', () => jest.fn());
const emailSender = require('../utilities/emailSender');

const {
  postReason,
  getAllReasons,
  getSingleReason,
  patchReason,
  deleteReason,
} = require('./reasonSchedulingController');

//  assertResMock

const flushPromises = () => new Promise(setImmediate);

function mockDay(dayIdx, past = false) {
  const date = moment().tz('America/Los_Angeles').startOf('day');
  while (date.day() !== dayIdx) {
    date.add(past ? -1 : 1, 'days');
  }
  return date;
}

const mockReason = () => ({
  _id: 'mockReasonId',
  reason: 'Mock Reason',
  date: moment.tz('America/Los_Angeles').startOf('day').toISOString(),
  userId: 'mockUserId',
});

describe('reasonScheduling Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRes.json = jest.fn();
    mockRes.status = jest.fn().mockReturnValue(mockRes);
    mockReq.body = {
      ...mockReq.body,
      ...mockUser(),
      reasonData: {
        date: mockDay(0),
        message: 'some reason',
      },
      currentDate: moment.tz('America/Los_Angeles').startOf('day'),
    };
    mockReq.params = {
      ...mockReq.params,
      ...mockUser(),
    };
    emailSender.mockResolvedValueOnce();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postReason method', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(UserModel, 'findById').mockResolvedValue(mockUser());
      jest.spyOn(ReasonModel, 'findOne').mockResolvedValue(null);
      jest.spyOn(ReasonModel.prototype, 'save').mockResolvedValue(mockReason());
      jest.spyOn(emailSender, 'mockResolvedValueOnce').mockResolvedValue();
    });
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

    test.skip('Ensure postReason returns 400 for warning to choose a future date', async () => {
      mockReq.body.reasonData.date = mockDay(0, true); // Past date
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
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => Promise.resolve(null));

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
        userId: mockReq.body.userId,
        date: moment.tz('America/Los_Angeles').startOf('day').toISOString(),
      };
      const mockFoundReason = jest.spyOn(ReasonModel, 'findOne').mockResolvedValue(mockReason);

      await postReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.body.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.body.userId,
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'The reason must be unique to the date',
          errorCode: 3,
        }),
      );
    });

    test.skip('Ensure postReason returns 400 when any error in saving.', async () => {
      jest.spyOn(UserModel, 'findById').mockResolvedValueOnce(mockUser());
      jest.spyOn(ReasonModel.prototype, 'save').mockRejectedValueOnce(new Error('Save failed'));
    
      await postReason(mockReq, mockRes);
      await flushPromises();
    
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errMessage: 'Save failed',
        }),
      );
    });

    test.skip('Ensure postReason returns 200 if schedule reason and send blue square email successfully', async () => {
      jest.spyOn(UserModel, 'findById').mockResolvedValueOnce(mockUser());
      jest.spyOn(ReasonModel.prototype, 'save').mockResolvedValueOnce({
        reason: mockReq.body.reasonData.message,
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.body.userId,
      });
      mockRes.sendStatus = jest.fn();
      emailSender.mockResolvedValueOnce();
    
      await postReason(mockReq, mockRes);
      await flushPromises();
    
      expect(mockRes.sendStatus).toHaveBeenCalledWith(200);
      expect(emailSender).toHaveBeenCalledWith(
        expect.stringContaining(mockUser().email),
        expect.stringContaining('Blue Square Reason'),
        expect.stringContaining('has set their Blue Square Reason'),
        null,
        null,
      );
    });
  });
  describe('getAllReason method', () => {
    test('Ensure get AllReason returns 404 when error in finding user Id', async () => {
      const mockFindUser = jest.spyOn(UserModel, 'findById').mockImplementationOnce(() => null);

      await getAllReasons(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found',
        }),
      );
    });
    test('Ensure get AllReason returns 400 when any error in fetching the user', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());
      const mockFoundReason = jest.spyOn(ReasonModel, 'find').mockRejectedValueOnce(null);
      await getAllReasons(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        userId: mockReq.params.userId,
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errMessage: 'Something went wrong while fetching the user',
        }),
      );
    });
    test('Ensure get AllReason returns 200 when get schedule reason successfully', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());
      const reasons = {
        reason: 'Some Reason',
        userId: mockReq.params.userId,
        date: moment.tz('America/Los_Angeles').startOf('day').toISOString(),
        isSet: true,
      };
      const mockFoundReason = jest.spyOn(ReasonModel, 'find').mockResolvedValue(reasons);
      await getAllReasons(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        userId: mockReq.params.userId,
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          reasons,
        }),
      );
    });
  });
  describe('getSingleReason method', () => {
    test('Ensure getSingleReason return 400 when any error in fetching the user', async () => {
      await getSingleReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Something went wrong while fetching single reason',
        }),
      );
    });
    test('Ensure getSingleReason return 404 when any error in find user by Id', async () => {
      mockReq.query = {
        queryData: mockDay(0),
      };
      const mockFindUser = jest.spyOn(UserModel, 'findById').mockImplementationOnce(() => null);

      await getSingleReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        }),
      );
    });
    test('Ensure getSingleReason return 200 if not found schedule reason and return empty object successfully.', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());

      mockReq.query = {
        queryDate: mockDay(0),
      };
      const mockFoundReason = jest.spyOn(ReasonModel, 'findOne').mockResolvedValueOnce();

      await getSingleReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        date: moment
          .tz(mockReq.query.queryDate, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.params.userId,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        reason: '',
        date: '',
        userId: '',
        isSet: false,
      });
    });
    test('Ensure getSingleReason return 200 if found schedule reason and return reason successfully.', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());

      mockReq.query = {
        queryDate: mockDay(0),
      };
      const singleReason = {
        reason: 'Some Reason',
        userId: mockReq.params.userId,
        date: moment.tz('America/Los_Angeles').startOf('day').toISOString(),
        isSet: true,
      };
      const mockFoundReason = jest.spyOn(ReasonModel, 'findOne').mockResolvedValue(singleReason);

      await getSingleReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        date: moment
          .tz(mockReq.query.queryDate, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.params.userId,
      });
      expect(mockRes.json).toHaveBeenCalledWith(singleReason);
    });
  });
  describe('patchReason method', () => {
    test('Ensure patchReason returns 400 for not providing reason', async () => {
      mockReq.body.reasonData.message = null;
      await patchReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'You must provide a reason.',
          errorCode: 6,
        }),
      );
    });
    test('Ensure patchReason returns 404 when error in finding user Id', async () => {
      const mockFindUser = jest.spyOn(UserModel, 'findById').mockImplementationOnce(() => null);

      await patchReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        }),
      );
    });
    test('Ensure patchReason returns 404 when error in finding reason', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());
      const mockFoundReason = jest.spyOn(ReasonModel, 'findOne').mockResolvedValueOnce();
      await patchReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.params.userId,
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Reason not found',
          errorCode: 4,
        }),
      );
    });
    test('Ensure patchReason returns 400 when any error in saving.', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());
      const oldReason = {
        reason: 'old message',
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.params.userId,
        save: jest.fn().mockRejectedValueOnce(),
      };
      emailSender.mockImplementation(() => {
        throw new Error('Failed to send email');
      });
      const mockFoundReason = jest.spyOn(ReasonModel, 'findOne').mockResolvedValueOnce(oldReason);
      await patchReason(mockReq, mockRes);
      await flushPromises();
      emailSender.mockRejectedValue(new Error('Failed'));
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.params.userId,
      });
      expect(oldReason.save).toHaveBeenCalledWith();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'something went wrong while patching the reason',
        }),
      );
    });
    test('Ensure patchReason returns 200 when any error in saving.', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());
      const oldReason = {
        reason: mockReq.body.reasonData.message,
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.params.userId,
        save: jest.fn().mockResolvedValueOnce(),
      };
      const mockFoundReason = jest.spyOn(ReasonModel, 'findOne').mockResolvedValueOnce(oldReason);
      emailSender.mockImplementation(() => {
        Promise.resolve();
      });
      await patchReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.params.userId,
      });
      expect(oldReason.save).toHaveBeenCalledWith();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Reason Updated!',
        }),
      );
    });
  });
  describe('deleteReason method', () => {
    test('Ensure deleteReason return 403 when no permission to delete', async () => {
      const newMockReq = {
        ...mockReq,
        body: {
          ...mockReq.body,
          ...mockReq.requestor,
          requestor: {
            role: 'Volunteer',
          },
        },
      };
      await deleteReason(newMockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'You must be an Owner or Administrator to schedule a reason for a Blue Square',

          errorCode: 1,
        }),
      );
    });
    test('Ensure deleteReason return 404 when not finding user by ID', async () => {
      const mockFindUser = jest.spyOn(UserModel, 'findById').mockImplementationOnce(() => null);
      await deleteReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found',
          errorCode: 2,
        }),
      );
    });
    test('Ensure deleteReason returns 404 when error in finding reason', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());

      const mockFoundReason = jest.spyOn(ReasonModel, 'findOne').mockResolvedValueOnce();
      await deleteReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Reason not found',
          errorCode: 4,
        }),
      );
    });
    test('Ensure deleteReason returns 500 when error in removing reason', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());
      const foundReason = {
        reason: mockReq.body.reasonData.message,
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.params.userId,
        remove: jest.fn((cb) => cb(true)),
      };
      const mockFoundReason = jest.spyOn(ReasonModel, 'findOne').mockReturnValueOnce(foundReason);

      await deleteReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error while deleting document',
          errorCode: 5,
        }),
      );
    });
    test('Ensure deleteReason returns 200 if delete reason successfully.', async () => {
      const mockFindUser = jest
        .spyOn(UserModel, 'findById')
        .mockImplementationOnce(() => mockUser());
      const foundReason = {
        reason: mockReq.body.reasonData.message,
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
        userId: mockReq.params.userId,
        remove: jest.fn((cb) => cb(false)),
      };
      const mockFoundReason = jest.spyOn(ReasonModel, 'findOne').mockReturnValueOnce(foundReason);

      await deleteReason(mockReq, mockRes);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockFindUser).toHaveBeenCalledWith(mockReq.params.userId);
      expect(mockFoundReason).toHaveBeenCalledWith({
        date: moment
          .tz(mockReq.body.reasonData.date, 'America/Los_Angeles')
          .startOf('day')
          .toISOString(),
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Document deleted',
        }),
      );
    });
  });
});
