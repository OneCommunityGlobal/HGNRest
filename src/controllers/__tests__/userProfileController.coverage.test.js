const mockCache = {
  getCache: jest.fn(),
  setCache: jest.fn(),
  removeCache: jest.fn(),
  hasCache: jest.fn(),
  clearByPrefix: jest.fn(),
};

const mockHasPermission = jest.fn();
const mockCanRequestorUpdateUser = jest.fn();

const mockUserHelper = {
  getEmailRecipientsForStatusChange: jest.fn(),
  checkTeamCodeMismatch: jest.fn(),
  sendUserResumedEmail: jest.fn(),
  sendUserReactivatedAfterSeparation: jest.fn(),
  sendUserCancelledSeparationEmail: jest.fn(),
  sendUserActivatedEmail: jest.fn(),
  sendUserPausedEmail: jest.fn(),
  sendUserSeparatedEmail: jest.fn(),
  sendUserScheduledSeparationEmail: jest.fn(),
  notifyInfringements: jest.fn(),
};

const mockVerifyToken = jest.fn();
const mockVerifyProdCredentials = jest.fn();
const mockIsProdIdentityEnforced = jest.fn();
const mockLogVerificationAttempt = jest.fn();
const mockEmitProductionUserStatusChange = jest.fn();

const mockLogger = {
  logInfo: jest.fn(),
  logError: jest.fn(),
  logException: jest.fn(),
};

jest.mock('../../utilities/nodeCache', () => () => mockCache);
jest.mock('../../helpers/userHelper', () => () => mockUserHelper);
jest.mock('../../utilities/permissions', () => ({
  hasPermission: (...args) => mockHasPermission(...args),
  canRequestorUpdateUser: (...args) => mockCanRequestorUpdateUser(...args),
}));
jest.mock('../../config/productionIdentityConfig', () => ({
  isProductionIdentityEnforcementActive: (...args) => mockIsProdIdentityEnforced(...args),
}));
jest.mock('../../services/productionIdentityService', () => ({
  verifyVerificationToken: (...args) => mockVerifyToken(...args),
  verifyProductionCredentials: (...args) => mockVerifyProdCredentials(...args),
}));
jest.mock('../productionIdentityController', () => ({
  logVerificationAttempt: (...args) => mockLogVerificationAttempt(...args),
}));
jest.mock('../../services/productionWebhookEmitter', () => ({
  emitProductionUserStatusChange: (...args) => mockEmitProductionUserStatusChange(...args),
}));
jest.mock('../../startup/logger', () => mockLogger);
jest.mock('../reportsController', () => () => ({
  invalidateWeeklySummariesCache: jest.fn(),
}));

const MockUserProfile = jest.fn(function MockUserProfile() {
  this._id = '507f191e810c19729de860ea';
  this.save = jest.fn().mockResolvedValue(this);
});

MockUserProfile.findOne = jest.fn();
MockUserProfile.findById = jest.fn();
MockUserProfile.aggregate = jest.fn();

const userProfileController = require('../userProfileController');

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
  json: jest.fn(),
});

describe('userProfileController targeted coverage tests', () => {
  const validUserId = '507f191e810c19729de860ea';
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCache.getCache.mockReturnValue(null);
    mockCache.hasCache.mockReturnValue(false);

    mockCanRequestorUpdateUser.mockResolvedValue(true);
    mockHasPermission.mockResolvedValue(true);

    mockIsProdIdentityEnforced.mockReturnValue(false);
    mockVerifyToken.mockReturnValue({ ok: false });
    mockVerifyProdCredentials.mockResolvedValue({ ok: true });
    mockLogVerificationAttempt.mockResolvedValue();
    mockEmitProductionUserStatusChange.mockResolvedValue();

    mockUserHelper.getEmailRecipientsForStatusChange.mockResolvedValue(['admin@example.com']);
    mockUserHelper.checkTeamCodeMismatch.mockResolvedValue(false);

    controller = userProfileController(MockUserProfile, {});
  });

  test('putUserProfile returns 400 when locked identity fields are changed', async () => {
    const req = {
      params: { userId: validUserId },
      body: {
        requestor: {
          requestorId: validUserId,
          role: 'Owner',
          permissions: { frontPermissions: ['editTeamCode'] },
        },
        firstName: 'Changed',
      },
    };
    const res = makeRes();

    MockUserProfile.findById.mockResolvedValue({
      _id: validUserId,
      firstName: 'Original',
      lastName: 'User',
      email: 'locked@example.com',
      identityLocked: true,
      teamCode: 'A1',
      infringements: [],
      save: jest.fn(),
    });

    await controller.putUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      'The firstName field is locked and cannot be changed for Production-linked accounts.',
    );
  });

  test('getUserProfiles executes aggregate projection with production identity fields', async () => {
    const req = {
      body: { requestor: { requestorId: validUserId } },
    };
    const res = makeRes();

    MockUserProfile.aggregate.mockResolvedValue([
      { _id: validUserId, firstName: 'A', lastName: 'B', productionUserId: 'prod-1' },
    ]);

    await controller.getUserProfiles(req, res);

    expect(MockUserProfile.aggregate).toHaveBeenCalled();
    const aggregatePipeline = MockUserProfile.aggregate.mock.calls[0][0];
    expect(aggregatePipeline[0].$project.productionUserId).toBe(1);
    expect(aggregatePipeline[0].$project.linkedProdEmail).toBe(1);
    expect(aggregatePipeline[0].$project.identityLocked).toBe(1);
    expect(aggregatePipeline[0].$project.deactivatedByProductionSync).toBe(1);
    expect(aggregatePipeline[0].$project.productionDeactivatedAt).toBe(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('postUserProfile returns production_verification error for invalid or missing token', async () => {
    mockIsProdIdentityEnforced.mockReturnValue(true);
    mockVerifyToken.mockReturnValue({ ok: false });

    const req = {
      ip: '127.0.0.1',
      body: {
        requestor: { requestorId: validUserId },
        role: 'Volunteer',
        firstName: 'Dev',
        lastName: 'User',
        email: 'dev@example.com',
      },
    };
    const res = makeRes();

    MockUserProfile.findOne.mockResolvedValueOnce(null);

    await controller.postUserProfile(req, res);

    expect(mockLogVerificationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'token_invalid',
        attemptedEmail: 'dev@example.com',
        action: 'create_user',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'production_verification',
        retryable: true,
      }),
    );
  });

  test('postUserProfile blocks duplicate production identity linkage', async () => {
    mockIsProdIdentityEnforced.mockReturnValue(true);
    mockVerifyToken.mockReturnValue({
      ok: true,
      identity: {
        productionUserId: 'prod-1',
        email: 'person@example.com',
        firstName: 'Prod',
        lastName: 'User',
      },
    });

    const req = {
      body: {
        requestor: { requestorId: validUserId },
        role: 'Volunteer',
        firstName: 'Dev',
        lastName: 'User',
        email: 'person@example.com',
        productionVerificationToken: 'token',
      },
    };
    const res = makeRes();

    MockUserProfile.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: 'already-linked' });

    await controller.postUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'production_linkage',
      }),
    );
  });

  test('postUserProfile applies verified production identity on successful creation', async () => {
    mockIsProdIdentityEnforced.mockReturnValue(true);
    mockVerifyToken.mockReturnValue({
      ok: true,
      identity: {
        productionUserId: '98765',
        email: 'verified@example.com',
        firstName: 'Verified',
        lastName: 'Identity',
      },
    });

    const requestor = {
      firstName: 'Req',
      lastName: 'Uestor',
      email: 'req@example.com',
      role: 'Owner',
    };

    const req = {
      body: {
        requestor: { requestorId: validUserId },
        role: 'Volunteer',
        firstName: 'DevName',
        lastName: 'BeforeVerify',
        email: 'verified@example.com',
        password: 'Password@123',
        productionVerificationToken: 'token',
      },
    };
    const res = makeRes();

    MockUserProfile.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    MockUserProfile.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(requestor) }),
    });

    await controller.postUserProfile(req, res);

    const createdUser = MockUserProfile.mock.instances[0];
    expect(createdUser.identityLocked).toBe(true);
    expect(createdUser.firstName).toBe('Verified');
    expect(createdUser.lastName).toBe('Identity');
    expect(createdUser.email).toBe('verified@example.com');
    expect(createdUser.linkedProdEmail).toBe('verified@example.com');
    expect(createdUser.productionUserId).toBe('98765');
    expect(createdUser.actualEmail).toBe('verified@example.com');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ _id: '507f191e810c19729de860ea' }),
    );
  });

  test('changeUserStatus blocks activation when user was deactivated by production sync', async () => {
    mockIsProdIdentityEnforced.mockReturnValue(true);

    const req = {
      params: { userId: validUserId },
      body: {
        action: 'ACTIVATE',
        requestor: {
          requestorId: validUserId,
          email: 'requestor@example.com',
        },
      },
    };
    const res = makeRes();

    MockUserProfile.findById.mockResolvedValue({
      _id: validUserId,
      isActive: false,
      email: 'dev@example.com',
      inactiveReason: 'separated',
      endDate: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      deactivatedByProductionSync: true,
      save: jest.fn().mockResolvedValue(),
    });

    await controller.changeUserStatus(req, res);

    expect(MockUserProfile.findById).toHaveBeenCalledWith(
      validUserId,
      expect.stringContaining('deactivatedByProductionSync'),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining(
          'deactivated because the linked Production account is inactive',
        ),
      }),
    );
  });

  test('changeUserStatus emits production webhook for deactivation and returns success', async () => {
    mockIsProdIdentityEnforced.mockReturnValue(false);
    mockEmitProductionUserStatusChange.mockImplementation(() =>
      Promise.reject(new Error('emit failed')),
    );

    const user = {
      _id: validUserId,
      isActive: true,
      email: 'member@example.com',
      firstName: 'Team',
      lastName: 'Member',
      inactiveReason: undefined,
      endDate: null,
      isSet: false,
      reactivationDate: null,
      save: jest.fn().mockResolvedValue(),
    };

    const req = {
      params: { userId: validUserId },
      body: {
        action: 'DEACTIVATE',
        endDate: '2026-07-30',
        requestor: {
          requestorId: validUserId,
          email: 'requestor@example.com',
        },
      },
    };
    const res = makeRes();

    MockUserProfile.findById.mockResolvedValue(user);

    await controller.changeUserStatus(req, res);
    await new Promise((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(mockEmitProductionUserStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        productionUserId: validUserId,
        email: 'member@example.com',
        status: 'inactive',
      }),
    );
    expect(mockLogger.logException).toHaveBeenCalledWith(
      expect.any(Error),
      'Failed to emit production identity webhook',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ message: 'status updated' });
  });
});
