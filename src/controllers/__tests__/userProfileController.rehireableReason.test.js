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

const MockUserProfile = jest.fn();
MockUserProfile.findByIdAndUpdate = jest.fn();
MockUserProfile.findById = jest.fn();

const userProfileController = require('../userProfileController');

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
  json: jest.fn(),
});

describe('userProfileController rehireable reason persistence', () => {
  const userId = '507f191e810c19729de860ea';
  let controller;
  let storedUser;

  const makeReq = (body = {}) => ({
    params: { userId },
    body: { requestor: { requestorId: 'requestor1', role: 'Owner' }, ...body },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
    mockCanRequestorUpdateUser.mockResolvedValue(true);
    mockCache.hasCache.mockReturnValue(false);

    storedUser = { _id: userId, email: 'user@example.com', isRehireable: true };
    MockUserProfile.findByIdAndUpdate.mockImplementation((id, update, opts, cb) => {
      Object.assign(storedUser, update.$set);
      cb(null, storedUser);
    });
    MockUserProfile.findById.mockImplementation((id, cb) => cb(null, storedUser));

    controller = userProfileController(MockUserProfile, {});
  });

  const patchAndGetSet = async (body) => {
    const res = makeRes();
    await controller.changeUserRehireableStatus(makeReq(body), res);
    return { res, set: MockUserProfile.findByIdAndUpdate.mock.calls[0]?.[1]?.$set };
  };

  test('saves and returns a trimmed reason when marking Not Rehireable', async () => {
    const { res, set } = await patchAndGetSet({
      isRehireable: false,
      notRehireableReason: '  Left the team  ',
    });

    expect(set).toEqual({ isRehireable: false, notRehireableReason: 'Left the team' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ isRehireable: false, notRehireableReason: 'Left the team' }),
    );
  });

  test('clears the saved reason when switching back to Rehireable', async () => {
    const { res, set } = await patchAndGetSet({
      isRehireable: true,
      notRehireableReason: 'stale reason',
    });

    expect(set).toEqual({ isRehireable: true, notRehireableReason: '' });
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ isRehireable: true, notRehireableReason: '' }),
    );
  });

  test.each([
    ['omitted', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
    ['non-string', 42],
  ])(
    'returns 400 and does not update when Not Rehireable with %s reason',
    async (_label, reason) => {
      const body = { isRehireable: false };
      if (reason !== undefined) body.notRehireableReason = reason;

      const { res } = await patchAndGetSet(body);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(MockUserProfile.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );

  test('accepts a single non-whitespace character', async () => {
    const { res, set } = await patchAndGetSet({ isRehireable: false, notRehireableReason: ' x ' });

    expect(set).toEqual({ isRehireable: false, notRehireableReason: 'x' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('does not require a reason when marking Rehireable', async () => {
    const { res, set } = await patchAndGetSet({ isRehireable: true });

    expect(set).toEqual({ isRehireable: true, notRehireableReason: '' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns 403 rather than 400 for an unauthorized invalid-reason request', async () => {
    mockHasPermission.mockResolvedValue(false);

    const { res } = await patchAndGetSet({ isRehireable: false, notRehireableReason: '  ' });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(MockUserProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('returns 403 and does not update when permission is missing', async () => {
    mockHasPermission.mockResolvedValue(false);

    const { res } = await patchAndGetSet({ isRehireable: false, notRehireableReason: 'x' });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(MockUserProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('returns 403 and does not update for a protected account', async () => {
    mockCanRequestorUpdateUser.mockResolvedValue(false);

    const { res } = await patchAndGetSet({ isRehireable: false, notRehireableReason: 'x' });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(MockUserProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('returns 400 for an invalid user id', async () => {
    const res = makeRes();
    const req = makeReq({ isRehireable: false });
    req.params.userId = 'not-an-id';

    await controller.changeUserRehireableStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(MockUserProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('getUserById returns the persisted reason without projecting it out', async () => {
    storedUser = { _id: userId, isRehireable: false, notRehireableReason: 'Left the team' };
    const query = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        ...storedUser,
        infringements: [],
        set: jest.fn(),
      }),
    };
    MockUserProfile.findById.mockReturnValue(query);
    const res = makeRes();

    await controller.getUserById({ params: { userId } }, res);

    const projection = MockUserProfile.findById.mock.calls[0][1];
    expect(projection).not.toMatch(/notRehireableReason/);
    expect(projection.split(' ').every((f) => f.startsWith('-'))).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ notRehireableReason: 'Left the team' }),
    );
  });
});
