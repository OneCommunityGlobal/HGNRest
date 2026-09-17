const mockSendMail = jest.fn();
const mockGetAccessToken = jest.fn();
const mockSetCredentials = jest.fn();
const modelRegistry = new Map();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        getAccessToken: mockGetAccessToken,
        setCredentials: mockSetCredentials,
      })),
    },
  },
}));

jest.mock('mongoose', () => {
  class MockSchema {
    constructor(definition) {
      this.definition = definition;
    }
  }

  MockSchema.Types = {
    ObjectId: 'ObjectId',
  };

  return {
    Schema: MockSchema,
    model: jest.fn((name) => {
      if (modelRegistry.has(name)) {
        return modelRegistry.get(name);
      }

      const model = jest.fn();
      model.findById = jest.fn();
      model.find = jest.fn();
      modelRegistry.set(name, model);
      return model;
    }),
    disconnect: jest.fn().mockResolvedValue(),
    isValidObjectId: jest.fn((id) => /^[a-f\d]{24}$/i.test(String(id))),
  };
});

const mockUserProfileModel = {
  find: jest.fn(),
};

jest.mock('../models/userProfile', () => mockUserProfileModel);

describe('rescheduleEventController', () => {
  let controller;
  let RescheduleEvent;
  let UserProfile;

  const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  const makeReq = (body = {}, params = {}, ip = '127.0.0.1') => ({
    body,
    params,
    ip,
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.NODE_ENV = 'test';
    delete process.env.TEST_EMAIL_ID;
    delete process.env.TEST_CLIENT_ID;
    delete process.env.TEST_CLIENT_SECRET;
    delete process.env.TEST_REDIRECT_URI;
    delete process.env.TEST_REFRESH_TOKEN;

    controller = require('./rescheduleEventContoller');
    RescheduleEvent = require('../models/rescheduleEvent');
    UserProfile = require('../models/userProfile');

    mockSendMail.mockReset();
    mockGetAccessToken.mockReset();
    mockSetCredentials.mockReset();
    mockUserProfileModel.find.mockReset();

    modelRegistry.clear();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.TEST_EMAIL_ID;
    delete process.env.TEST_CLIENT_ID;
    delete process.env.TEST_CLIENT_SECRET;
    delete process.env.TEST_REDIRECT_URI;
    delete process.env.TEST_REFRESH_TOKEN;
  });

  it('returns 400 for an unsupported activity id in rescheduleNotify', async () => {
    const req = makeReq({}, { activityId: 'abc' });
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid activity id' });
  });

  it('returns 404 when the activity cannot be found for a valid object id', async () => {
    const validObjectId = '507f1f77bcf86cd799439011';
    RescheduleEvent.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const req = makeReq(
      { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
      { activityId: validObjectId },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(RescheduleEvent.findById).toHaveBeenCalledWith(validObjectId);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Activity not found' });
  });

  it('returns 400 when reschedule options are missing or empty', async () => {
    const req = makeReq({}, { activityId: '1' });
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'options[] is required and must be non-empty',
    });
  });

  it('returns 400 when more than five options are supplied', async () => {
    const req = makeReq(
      {
        options: Array.from({ length: 6 }, (_, index) => ({
          dateISO: '2025-02-23',
          start: '12:00',
          end: '13:00',
          label: `option-${index}`,
        })),
      },
      { activityId: '1' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'At most 5 options allowed' });
  });

  it('returns 400 for an invalid date format', async () => {
    const req = makeReq(
      { options: [{ dateISO: '02-23-2025', start: '12:00', end: '13:00' }] },
      { activityId: '1' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'dateISO must be YYYY-MM-DD' });
  });

  it('returns 400 for invalid start or end time formats', async () => {
    const req = makeReq(
      { options: [{ dateISO: '2025-02-23', start: '12:0', end: '13:00' }] },
      { activityId: '1' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'start/end must be HH:MM (24h)' });
  });

  it('returns an appropriate response when no participant emails exist', async () => {
    RescheduleEvent.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        title: 'No Email Activity',
        description: 'No email recipients',
        date: '2025-02-23T12:00:00Z',
        location: 'Remote',
        participants: [],
      }),
    });

    const req = makeReq(
      { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
      { activityId: '507f1f77bcf86cd799439011' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(res.json).toHaveBeenCalledWith({
      message: 'No valid participant emails',
      notified: 0,
    });
  });

  it('creates a local mock poll and returns dry-run email details for mock activity ids', async () => {
    const req = makeReq(
      {
        options: [
          { dateISO: '2025-02-23', start: '12:00', end: '13:00' },
          { dateISO: '2025-02-24', start: '14:00', end: '15:00' },
        ],
        reason: 'Venue issue',
        timezone: 'America/Los_Angeles',
      },
      { activityId: '1' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Reschedule poll created; email delivery skipped locally',
        activityId: '1',
        notified: 0,
        skipped: 3,
        emailMode: 'dry-run',
        reason: 'Venue issue',
        timezone: 'America/Los_Angeles',
        dispatchId: expect.any(String),
        options: req.body.options,
      }),
    );
  });

  it('returns 400 for an unsupported activity id in getReschedulePoll', async () => {
    const req = makeReq({}, { activityId: 'abc' });
    const res = makeRes();

    await controller.getReschedulePoll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid activity id' });
  });

  it('returns 500 when production email configuration is missing and sendEmail throws', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.TEST_EMAIL_ID = 'tester@example.com';
    process.env.TEST_CLIENT_ID = 'client';
    process.env.TEST_CLIENT_SECRET = 'secret';
    process.env.TEST_REDIRECT_URI = 'https://example.test';
    process.env.TEST_REFRESH_TOKEN = 'token';
    mockGetAccessToken.mockResolvedValue(null);

    controller = require('./rescheduleEventContoller');
    RescheduleEvent = require('../models/rescheduleEvent');

    RescheduleEvent.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        title: 'Production email error',
        description: 'Should fail in production',
        date: '2025-02-23T12:00:00Z',
        location: 'Remote',
        participants: [{ email: 'prod@example.com' }],
      }),
    });

    const req = makeReq(
      { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
      { activityId: '507f1f77bcf86cd799439011' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Server error',
      error: 'NO_OAUTH_ACCESS_TOKEN',
    });
  });

  it('sends mail through the configured oauth transport when credentials are present', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.TEST_EMAIL_ID = 'tester@example.com';
    process.env.TEST_CLIENT_ID = 'client';
    process.env.TEST_CLIENT_SECRET = 'secret';
    process.env.TEST_REDIRECT_URI = 'https://example.test';
    process.env.TEST_REFRESH_TOKEN = 'token';
    mockGetAccessToken.mockResolvedValue({ token: 'oauth-token' });
    mockSendMail.mockResolvedValue({ messageId: 'sent-id' });

    controller = require('./rescheduleEventContoller');
    RescheduleEvent = require('../models/rescheduleEvent');

    const req = makeReq(
      { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
      { activityId: '1' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(mockSendMail).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Reschedule notification sent',
        emailMode: 'sent',
      }),
    );
  });

  it('uses object-based participant emails when user profile lookups do not resolve', async () => {
    const activity = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Object email activity',
      description: 'Uses participant object emails',
      date: '2025-02-23T12:00:00Z',
      location: 'Remote',
      participants: [{ email: 'direct@example.com' }, { email: 'direct2@example.com' }],
    };

    RescheduleEvent.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(activity),
    });

    const req = makeReq(
      { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
      { activityId: '507f1f77bcf86cd799439011' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        skipped: 2,
        notified: 0,
        emailMode: 'dry-run',
      }),
    );
  });

  it('falls back to a no-email response when user profile lookups return no addresses', async () => {
    const activity = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Profile fallback activity',
      description: 'No emails returned from users',
      date: '2025-02-23T12:00:00Z',
      location: 'Remote',
      participants: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'],
    };

    RescheduleEvent.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(activity),
    });
    mockUserProfileModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const req = makeReq(
      { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
      { activityId: '507f1f77bcf86cd799439011' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(mockUserProfileModel.find).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      message: 'No valid participant emails',
      notified: 0,
    });
  });

  it('returns a missing-field validation error when an option omits a required field', async () => {
    const req = makeReq(
      { options: [{ dateISO: '2025-02-23', start: '12:00' }] },
      { activityId: '1' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Each option must include dateISO, start, end',
    });
  });

  it('returns a 404 from getReschedulePoll when the activity lookup fails after a poll exists', async () => {
    const validObjectId = '507f1f77bcf86cd799439011';
    RescheduleEvent.findById
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: validObjectId,
          title: 'Lookup failure activity',
          description: 'Missing activity on poll read',
          date: '2025-02-23T12:00:00Z',
          location: 'Remote',
          participants: [],
        }),
      })
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(null),
      });

    const notifyRes = makeRes();
    await controller.rescheduleNotify(
      makeReq(
        { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
        { activityId: validObjectId },
      ),
      notifyRes,
    );

    const pollRes = makeRes();
    await controller.getReschedulePoll(makeReq({}, { activityId: validObjectId }), pollRes);

    expect(pollRes.status).toHaveBeenCalledWith(404);
    expect(pollRes.json).toHaveBeenCalledWith({ message: 'No active poll for this activity' });
  });

  it('returns 404 when no poll exists for the activity', async () => {
    const req = makeReq({}, { activityId: '2' });
    const res = makeRes();

    await controller.getReschedulePoll(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'No active poll for this activity' });
  });

  it('returns public poll information without exposing internal vote tracking', async () => {
    const req = makeReq(
      {
        options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }],
        timezone: 'UTC',
        reason: 'Rain',
      },
      { activityId: '1' },
    );
    const res = makeRes();

    await controller.rescheduleNotify(req, res);
    const pollRes = makeRes();

    await controller.getReschedulePoll(makeReq({}, { activityId: '1' }), pollRes);

    expect(pollRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: expect.objectContaining({
          id: '1',
          title: 'Test Event',
          location: 'San Francisco, CA 94108',
          description: 'test event for rescheduling',
        }),
        timezone: 'UTC',
        reason: 'Rain',
        options: req.body.options,
      }),
    );
    expect(pollRes.json.mock.calls[0][0]).not.toHaveProperty('voters');
    expect(pollRes.json.mock.calls[0][0]).not.toHaveProperty('votes');
    expect(pollRes.json.mock.calls[0][0]).not.toHaveProperty('dispatchId');
  });

  it('returns 400 for an unsupported activity id in submitRescheduleVote', async () => {
    const req = makeReq({ optionIdx: 0 }, { activityId: 'abc' });
    const res = makeRes();

    await controller.submitRescheduleVote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid activity id' });
  });

  it('returns 404 when no poll exists for the vote request', async () => {
    const req = makeReq({ optionIdx: 0 }, { activityId: '2' });
    const res = makeRes();

    await controller.submitRescheduleVote(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'No active poll for this activity' });
  });

  it('returns 400 for a non-integer option index', async () => {
    await controller.rescheduleNotify(
      makeReq(
        { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
        { activityId: '1' },
      ),
      makeRes(),
    );

    const req = makeReq({ optionIdx: 'abc' }, { activityId: '1' });
    const res = makeRes();

    await controller.submitRescheduleVote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid option index' });
  });

  it('returns 400 for a negative option index', async () => {
    await controller.rescheduleNotify(
      makeReq(
        { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
        { activityId: '1' },
      ),
      makeRes(),
    );

    const req = makeReq({ optionIdx: -1 }, { activityId: '1' });
    const res = makeRes();

    await controller.submitRescheduleVote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid option index' });
  });

  it('returns 400 for an out-of-range option index', async () => {
    await controller.rescheduleNotify(
      makeReq(
        { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
        { activityId: '1' },
      ),
      makeRes(),
    );

    const req = makeReq({ optionIdx: 3 }, { activityId: '1' });
    const res = makeRes();

    await controller.submitRescheduleVote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid option index' });
  });

  it('records a valid vote and returns 200', async () => {
    await controller.rescheduleNotify(
      makeReq(
        { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
        { activityId: '1' },
      ),
      makeRes(),
    );

    const req = makeReq(
      { optionIdx: 0, requestor: { requestorId: 'user-1' } },
      { activityId: '1' },
    );
    const res = makeRes();

    await controller.submitRescheduleVote(req, res);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Vote recorded',
      activityId: '1',
      optionIdx: 0,
    });
  });

  it('prevents a second vote from the same requestor and allows separate requestors to vote', async () => {
    await controller.rescheduleNotify(
      makeReq(
        { options: [{ dateISO: '2025-02-23', start: '12:00', end: '13:00' }] },
        { activityId: '1' },
      ),
      makeRes(),
    );

    const firstRes = makeRes();
    await controller.submitRescheduleVote(
      makeReq({ optionIdx: 0, requestor: { requestorId: 'user-1' } }, { activityId: '1' }),
      firstRes,
    );

    const secondRes = makeRes();
    await controller.submitRescheduleVote(
      makeReq({ optionIdx: 0, requestor: { requestorId: 'user-1' } }, { activityId: '1' }),
      secondRes,
    );

    expect(secondRes.status).toHaveBeenCalledWith(409);
    expect(secondRes.json).toHaveBeenCalledWith({
      message: 'A vote has already been recorded for this activity',
    });

    const thirdRes = makeRes();
    await controller.submitRescheduleVote(
      makeReq({ optionIdx: 0, requestor: { requestorId: 'user-2' } }, { activityId: '1' }),
      thirdRes,
    );

    expect(thirdRes.json).toHaveBeenCalledWith({
      message: 'Vote recorded',
      activityId: '1',
      optionIdx: 0,
    });
  });

  it('returns a server error when submitRescheduleVote receives an invalid request shape', async () => {
    const req = { body: { optionIdx: 0 }, params: undefined, ip: '127.0.0.1' };
    const res = makeRes();

    await controller.submitRescheduleVote(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Server error',
      error: expect.stringContaining('Cannot destructure property'),
    });
  });

  it('uses the RescheduleEvent model safely', () => {
    expect(typeof RescheduleEvent).toBe('function');
    expect(typeof RescheduleEvent.findById).toBe('function');
    expect(RescheduleEvent.findById).toBeDefined();
  });
});
