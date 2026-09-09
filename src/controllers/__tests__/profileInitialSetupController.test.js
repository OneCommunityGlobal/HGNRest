// NOTE: this project's babel config excludes *.test.js from transform, so
// Jest's automatic jest.mock() hoisting does not apply here. jest.mock()
// calls must come before any require() of the same module, or the
// requiring module (including profileInitialSetupController itself) will
// capture the real, unmocked implementation.
jest.mock('jsonwebtoken');
// A factory mock avoids loading the real emailSender module, which pulls in
// emailHistory.js and touches real mongoose.SchemaTypes at require-time -
// something the minimal mongoose mock below does not provide.
jest.mock('../../utilities/emailSender', () => jest.fn());
jest.mock('../../utilities/nodeCache', () => () => ({
  getCache: jest.fn().mockReturnValue('[]'),
  setCache: jest.fn(),
}));
jest.mock('../../startup/logger', () => ({
  logException: jest.fn(),
  logInfo: jest.fn(),
}));
jest.mock('mongoose', () => ({
  startSession: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const LOGGER = require('../../startup/logger');
const emailSender = require('../../utilities/emailSender');
const profileInitialSetupController = require('../profileInitialSetupController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.send = jest.fn().mockReturnThis();
  return res;
};

// Query-chain helper for calls shaped like `Model.findOne(...).session(session)`.
const sessionChain = (value, { reject = false } = {}) => ({
  session: jest
    .fn()
    .mockImplementation(() => (reject ? Promise.reject(value) : Promise.resolve(value))),
});

// Builds a mock mongoose-style model that supports `new Model(data)` + `.save()`.
const createModelConstructorMock = (extraInstanceDefaults = {}) => {
  const Model = jest.fn().mockImplementation(function ctor(data) {
    Object.assign(this, extraInstanceDefaults, data);
    this.save = jest.fn().mockImplementation(() => Promise.resolve(this));
    return this;
  });
  Model.findOne = jest.fn();
  Model.find = jest.fn();
  Model.findOneAndDelete = jest.fn();
  Model.findOneAndUpdate = jest.fn();
  Model.findByIdAndDelete = jest.fn();
  return Model;
};

describe('profileInitialSetupController', () => {
  let controller;
  let mockProfileInitialSetupToken;
  let mockUserProfile;
  let mockProject;
  let mockMapLocation;
  let mockSession;

  beforeEach(() => {
    // jest.clearAllMocks() only clears call history - it does not remove
    // implementations set via mockResolvedValue/mockRejectedValue. Reset
    // those explicitly so a rejection configured in one test can't leak
    // into a later test's un-awaited, fire-and-forget emailSender() call.
    jest.resetAllMocks();
    emailSender.mockResolvedValue('sent');

    mockProfileInitialSetupToken = createModelConstructorMock();
    mockUserProfile = createModelConstructorMock({ privacySettings: {} });
    mockProject = { findOne: jest.fn() };
    mockMapLocation = { find: jest.fn() };

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(),
      abortTransaction: jest.fn().mockResolvedValue(),
      endSession: jest.fn(),
    };
    mongoose.startSession.mockResolvedValue(mockSession);

    controller = profileInitialSetupController(
      mockProfileInitialSetupToken,
      mockUserProfile,
      mockProject,
      mockMapLocation,
    );
  });

  describe('getSetupToken', () => {
    const baseReq = () => ({
      body: { email: 'New.User@Example.com', baseUrl: 'http://test.com', weeklyCommittedHours: 10 },
    });

    it('returns 400 EMAIL_IN_USE and aborts the transaction when the email already exists', async () => {
      mockUserProfile.findOne.mockReturnValue(sessionChain({ email: 'new.user@example.com' }));
      const req = baseReq();
      const res = makeRes();

      await controller.getSetupToken(req, res);

      expect(mockUserProfile.findOne).toHaveBeenCalledWith({ email: 'new.user@example.com' });
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: 'EMAIL_IN_USE' });
    });

    it('creates a token, sends the invite email, and returns 200 on success', async () => {
      mockUserProfile.findOne.mockReturnValue(sessionChain(null));
      mockProfileInitialSetupToken.findOneAndDelete.mockReturnValue(sessionChain(null));
      emailSender.mockResolvedValue('sent');

      const req = baseReq();
      const res = makeRes();

      await controller.getSetupToken(req, res);

      expect(mockProfileInitialSetupToken).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(emailSender).toHaveBeenCalledTimes(1);
      expect(emailSender.mock.calls[0][0]).toBe('new.user@example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ sent: true });
    });

    it('returns 500 MAIL_SEND_FAILED when the invite email fails to send', async () => {
      mockUserProfile.findOne.mockReturnValue(sessionChain(null));
      mockProfileInitialSetupToken.findOneAndDelete.mockReturnValue(sessionChain(null));
      emailSender.mockRejectedValue(new Error('smtp down'));

      const req = baseReq();
      const res = makeRes();

      await controller.getSetupToken(req, res);

      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: 'MAIL_SEND_FAILED' });
    });

    it('returns 500 TOKEN_CREATION_FAILED and rolls back the transaction on unexpected error', async () => {
      mockUserProfile.findOne.mockReturnValue(sessionChain(null));
      mockProfileInitialSetupToken.findOneAndDelete.mockReturnValue(
        sessionChain(new Error('db exploded'), { reject: true }),
      );

      const req = baseReq();
      const res = makeRes();

      await controller.getSetupToken(req, res);

      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: 'TOKEN_CREATION_FAILED' });
    });
  });

  describe('validateSetupToken', () => {
    it('returns 404 when the token does not exist', async () => {
      mockProfileInitialSetupToken.findOne.mockResolvedValue(null);
      const req = { body: { token: 'missing-token' } };
      const res = makeRes();

      await controller.validateSetupToken(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('NOT_FOUND');
    });

    it('returns 400 SETUP_ALREADY_COMPLETED when isSetupCompleted is true', async () => {
      mockProfileInitialSetupToken.findOne.mockResolvedValue({
        isSetupCompleted: true,
        isCancelled: false,
        expiration: new Date(Date.now() + 100000),
      });
      const req = { body: { token: 'a-token' } };
      const res = makeRes();

      await controller.validateSetupToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('SETUP_ALREADY_COMPLETED');
    });

    it('returns 400 CANCELLED when isCancelled is true', async () => {
      mockProfileInitialSetupToken.findOne.mockResolvedValue({
        isSetupCompleted: false,
        isCancelled: true,
        expiration: new Date(Date.now() + 100000),
      });
      const req = { body: { token: 'a-token' } };
      const res = makeRes();

      await controller.validateSetupToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('CANCELLED');
    });

    it('returns 400 EXPIRED when the expiration date has passed', async () => {
      mockProfileInitialSetupToken.findOne.mockResolvedValue({
        isSetupCompleted: false,
        isCancelled: false,
        expiration: new Date(Date.now() - 100000),
      });
      const req = { body: { token: 'a-token' } };
      const res = makeRes();

      await controller.validateSetupToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('EXPIRED');
    });

    it('returns 200 with the token when it is valid', async () => {
      const mockToken = {
        token: 'a-token',
        isSetupCompleted: false,
        isCancelled: false,
        expiration: new Date(Date.now() + 100000),
      };
      mockProfileInitialSetupToken.findOne.mockResolvedValue(mockToken);
      const req = { body: { token: 'a-token' } };
      const res = makeRes();

      await controller.validateSetupToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockToken);
    });

    it('returns 500 when the database lookup throws', async () => {
      mockProfileInitialSetupToken.findOne.mockRejectedValue(new Error('db down'));
      const req = { body: { token: 'a-token' } };
      const res = makeRes();

      await controller.validateSetupToken(req, res);

      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getTimeZoneAPIKeyByToken', () => {
    it('returns 200 with the API key for a valid token', async () => {
      mockProfileInitialSetupToken.findOne.mockResolvedValue({ token: 'valid-token' });
      process.env.TIMEZONE_PREMIUM_KEY = 'test-api-key';
      const req = { body: { token: 'valid-token' } };
      const res = makeRes();

      await controller.getTimeZoneAPIKeyByToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ userAPIKey: 'test-api-key' });
    });

    it('returns 403 when the token is not found', async () => {
      mockProfileInitialSetupToken.findOne.mockResolvedValue(null);
      const req = { body: { token: 'unknown-token' } };
      const res = makeRes();

      await controller.getTimeZoneAPIKeyByToken(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith('Unauthorized Request');
    });
  });

  describe('setUpNewUser', () => {
    const baseBody = () => ({
      token: 'a-token',
      password: 'pw',
      firstName: 'Jane',
      lastName: 'Doe',
      jobTitle: 'Volunteer',
      phoneNumber: '1234567890',
      collaborationPreference: 'Slack',
      timeZone: 'America/Los_Angeles',
      location: { userProvided: 'NY', country: 'USA' },
      profilePicture: '',
      privacySettings: { email: true, phoneNumber: true },
      email: 'jane.doe@example.com',
      homeCountry: 'USA',
    });

    it('returns 400 when the token cannot be found', async () => {
      mockProfileInitialSetupToken.findOne.mockResolvedValue(null);
      const req = { body: { token: 'missing' } };
      const res = makeRes();

      await controller.setUpNewUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid token');
    });

    it('returns 400 when the email is already in use', async () => {
      mockProfileInitialSetupToken.findOne.mockResolvedValue({
        email: 'jane.doe@example.com',
        expiration: new Date(Date.now() + 100000),
      });
      mockUserProfile.findOne.mockResolvedValue({ email: 'jane.doe@example.com' });
      const req = { body: baseBody() };
      const res = makeRes();

      await controller.setUpNewUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('email already in use');
    });

    it('returns 400 Token is expired when the setup token has expired', async () => {
      mockProfileInitialSetupToken.findOne.mockResolvedValue({
        email: 'jane.doe@example.com',
        expiration: new Date(Date.now() - 100000),
      });
      mockUserProfile.findOne.mockResolvedValue(null);
      const req = { body: baseBody() };
      const res = makeRes();

      await controller.setUpNewUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Token is expired');
    });

    it('creates the user and returns a signed JWT for a valid token', async () => {
      const foundToken = {
        _id: 'token-id',
        email: 'jane.doe@example.com',
        weeklyCommittedHours: 15,
        expiration: new Date(Date.now() + 100000),
      };
      mockProfileInitialSetupToken.findOne.mockResolvedValue(foundToken);
      mockUserProfile.findOne.mockResolvedValue(null);
      mockProject.findOne.mockResolvedValue({ projectName: 'Orientation and Initial Setup' });
      mockProfileInitialSetupToken.findByIdAndDelete.mockResolvedValue(foundToken);
      jwt.sign.mockReturnValue('signed-jwt-token');

      const req = { body: baseBody() };
      const res = makeRes();

      await controller.setUpNewUser(req, res);

      // Exactly one user is created for a valid token.
      expect(mockUserProfile).toHaveBeenCalledTimes(1);
      expect(mockProfileInitialSetupToken.findByIdAndDelete).toHaveBeenCalledWith('token-id');
      expect(emailSender).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ token: 'signed-jwt-token' });

      // NOTE: after the 200 response, the handler calls an undefined
      // `setMapLocation` helper, which throws and is caught by the outer
      // catch block, producing a follow-up 500 response for the same request.
      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('returns 500 when an unexpected error occurs', async () => {
      mockProfileInitialSetupToken.findOne.mockRejectedValue(new Error('db exploded'));
      const req = { body: { token: 'a-token' } };
      const res = makeRes();

      await controller.setUpNewUser(req, res);

      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Error:'));
    });
  });

  describe('getTotalCountryCount', () => {
    it('counts unique countries from qualifying users and map locations', async () => {
      mockUserProfile.find.mockResolvedValue([
        // Qualifies via totalTangibleHrs >= 10
        {
          location: { coords: { lat: 40, lng: -74 }, country: 'US' },
          totalTangibleHrs: 15,
          hoursByCategory: { housing: 1 },
        },
        // Qualifies via sum(hoursByCategory) >= 10, distinct country
        {
          location: { coords: { lat: 10, lng: 20 }, country: 'CA' },
          totalTangibleHrs: 2,
          hoursByCategory: { housing: 6, food: 5 },
        },
        // Same country as the first user - should not increase the unique count
        {
          location: { coords: { lat: 1, lng: 1 }, country: 'US' },
          totalTangibleHrs: 12,
          hoursByCategory: { housing: 1 },
        },
        // Does not qualify: no location and low hours
        {
          location: undefined,
          totalTangibleHrs: 1,
          hoursByCategory: { housing: 1 },
        },
      ]);
      mockMapLocation.find.mockResolvedValue([{ location: { country: 'MX' } }]);

      const req = {};
      const res = makeRes();

      await controller.getTotalCountryCount(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ CountryCount: 3 });
    });

    it('returns a count of 0 when there are no qualifying users or map locations', async () => {
      mockUserProfile.find.mockResolvedValue([]);
      mockMapLocation.find.mockResolvedValue([]);

      const res = makeRes();
      await controller.getTotalCountryCount({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ CountryCount: 0 });
    });

    it('returns 500 when the database lookup throws', async () => {
      mockUserProfile.find.mockRejectedValue(new Error('db down'));

      const res = makeRes();
      await controller.getTotalCountryCount({}, res);

      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSetupInvitation', () => {
    const withFindResult = (result) => {
      mockProfileInitialSetupToken.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn((cb) => cb(null, result)),
        }),
      });
    };

    it('returns 403 for a requestor without an authorized role or permission', () => {
      const req = {
        body: { requestor: { role: 'Volunteer', permissions: { frontPermissions: [] } } },
      };
      const res = makeRes();

      controller.getSetupInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockProfileInitialSetupToken.find).not.toHaveBeenCalled();
    });

    it('returns 200 with pending invitations for an Administrator', () => {
      withFindResult([{ email: 'a@example.com' }]);
      const req = {
        body: { requestor: { role: 'Administrator', permissions: { frontPermissions: [] } } },
      };
      const res = makeRes();

      controller.getSetupInvitation(req, res);

      expect(mockProfileInitialSetupToken.find).toHaveBeenCalledWith({ isSetupCompleted: false });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([{ email: 'a@example.com' }]);
    });

    it('authorizes a requestor via matching frontPermissions even without a privileged role', () => {
      withFindResult([]);
      const req = {
        body: {
          requestor: {
            role: 'Volunteer',
            permissions: { frontPermissions: ['getUserProfiles'] },
          },
        },
      };
      const res = makeRes();

      controller.getSetupInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 500 when the query callback receives an error', () => {
      mockProfileInitialSetupToken.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn((cb) => cb(new Error('db error'))),
        }),
      });
      const req = {
        body: { requestor: { role: 'Owner', permissions: { frontPermissions: [] } } },
      };
      const res = makeRes();

      controller.getSetupInvitation(req, res);

      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('returns 500 when the query throws synchronously', () => {
      mockProfileInitialSetupToken.find.mockImplementation(() => {
        throw new Error('boom');
      });
      const req = {
        body: { requestor: { role: 'Manager', permissions: { frontPermissions: [] } } },
      };
      const res = makeRes();

      controller.getSetupInvitation(req, res);

      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('cancelSetupInvitation', () => {
    it('returns 403 for a requestor who is not an Administrator or Owner', () => {
      const req = { body: { requestor: { role: 'Manager' }, token: 'a-token' } };
      const res = makeRes();

      controller.cancelSetupInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockProfileInitialSetupToken.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('cancels the invitation, emails an acknowledgment, and returns 200', () => {
      const result = { token: 'a-token', email: 'a@example.com' };
      mockProfileInitialSetupToken.findOneAndUpdate.mockImplementation((query, update, cb) =>
        cb(null, result),
      );
      emailSender.mockResolvedValue('ok');

      const req = { body: { requestor: { role: 'Administrator' }, token: 'a-token' } };
      const res = makeRes();

      controller.cancelSetupInvitation(req, res);

      expect(mockProfileInitialSetupToken.findOneAndUpdate).toHaveBeenCalledWith(
        { token: 'a-token' },
        { isCancelled: true },
        expect.any(Function),
      );
      expect(emailSender).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(result);
    });

    it('returns 500 when the update callback receives an error', () => {
      mockProfileInitialSetupToken.findOneAndUpdate.mockImplementation((query, update, cb) =>
        cb(new Error('db error')),
      );

      const req = { body: { requestor: { role: 'Owner' }, token: 'a-token' } };
      const res = makeRes();

      controller.cancelSetupInvitation(req, res);

      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('returns 500 when the update throws synchronously', () => {
      mockProfileInitialSetupToken.findOneAndUpdate.mockImplementation(() => {
        throw new Error('boom');
      });

      const req = { body: { requestor: { role: 'Administrator' }, token: 'a-token' } };
      const res = makeRes();

      controller.cancelSetupInvitation(req, res);

      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('refreshSetupInvitation', () => {
    const baseReq = () => ({
      body: { requestor: { role: 'Administrator' }, token: 'a-token', baseUrl: 'http://test.com' },
    });

    it('returns 403 for a requestor who is not an Administrator or Owner', async () => {
      const req = { body: { requestor: { role: 'Manager' }, token: 'a-token' } };
      const res = makeRes();

      await controller.refreshSetupInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockProfileInitialSetupToken.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('returns 403 when requestor is missing entirely', async () => {
      const req = { body: { token: 'a-token' } };
      const res = makeRes();

      await controller.refreshSetupInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when the invitation is not found', async () => {
      mockProfileInitialSetupToken.findOneAndUpdate.mockResolvedValue(null);
      const req = baseReq();
      const res = makeRes();

      await controller.refreshSetupInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Setup invitation not found.');
    });

    it('refreshes the invitation and returns 200 when the email sends successfully', async () => {
      const result = { token: 'a-token', email: 'a@example.com' };
      mockProfileInitialSetupToken.findOneAndUpdate.mockResolvedValue(result);
      emailSender.mockResolvedValue('sent');

      const req = baseReq();
      const res = makeRes();

      await controller.refreshSetupInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(result);
    });

    it('returns 503 when email sending is disabled', async () => {
      const result = { token: 'a-token', email: 'a@example.com' };
      mockProfileInitialSetupToken.findOneAndUpdate.mockResolvedValue(result);
      emailSender.mockReturnValue(undefined);

      const req = baseReq();
      const res = makeRes();

      await controller.refreshSetupInvitation(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.send).toHaveBeenCalledWith('Invitation refreshed, but email sending is disabled.');
    });

    it('returns 502 when the email fails to send', async () => {
      const result = { token: 'a-token', email: 'a@example.com' };
      mockProfileInitialSetupToken.findOneAndUpdate.mockResolvedValue(result);
      emailSender.mockReturnValue(Promise.reject(new Error('smtp down')));

      const req = baseReq();
      const res = makeRes();

      await controller.refreshSetupInvitation(req, res);

      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.send).toHaveBeenCalledWith('Invitation refreshed, but email failed to send.');
    });

    it('returns 500 when the database update throws', async () => {
      mockProfileInitialSetupToken.findOneAndUpdate.mockRejectedValue(new Error('db down'));

      const req = baseReq();
      const res = makeRes();

      await controller.refreshSetupInvitation(req, res);

      expect(LOGGER.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
