/**
 * Tests for pausing and resuming a user.
 *
 * There are two implementations of "pause" in this controller. The buttons in
 * User Management and on the profile page call `pauseResumeUser`, which wrote
 * only `isActive` and `reactivationDate`, while `changeUserStatus` writes the
 * full lifecycle field set. Everything that reads the missing fields was
 * therefore wrong for anyone paused from the UI: the resume email had no
 * paused-on date to report, and a final day set before the pause was left on
 * the record.
 *
 * These tests pin both endpoints to the same field set so they cannot drift
 * apart again, and pin the reactivation date to the start of that day in
 * company time. The date matters: the modal sends a plain 'YYYY-MM-DD' string,
 * and parsing it in the server's timezone before converting lands on the
 * previous Pacific day on any server east of Los Angeles, which is every
 * server we run on.
 */

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

const mockLogger = { logInfo: jest.fn(), logError: jest.fn(), logException: jest.fn() };
const mockIsProdIdentityEnforced = jest.fn();
const mockEmitProductionUserStatusChange = jest.fn();

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
  verifyVerificationToken: jest.fn(),
  verifyProductionCredentials: jest.fn(),
}));
jest.mock('../productionIdentityController', () => ({ logVerificationAttempt: jest.fn() }));
jest.mock('../../services/productionWebhookEmitter', () => ({
  emitProductionUserStatusChange: (...args) => mockEmitProductionUserStatusChange(...args),
}));
jest.mock('../../startup/logger', () => mockLogger);
jest.mock('../reportsController', () => () => ({ invalidateWeeklySummariesCache: jest.fn() }));

const moment = require('moment-timezone');
const userProfileController = require('../userProfileController');
const { COMPANY_TZ } = require('../../constants/company');
const { InactiveReason, UserStatusOperations } = require('../../constants/userProfile');

const USER_ID = '507f191e810c19729de860ea';
const PAUSE_UNTIL = '2026-09-20';
const NOW = '2026-09-01T18:30:00.000Z';

/** The fields that together say where a user is in their lifecycle. */
const LIFECYCLE_FIELDS = [
  'isActive',
  'inactiveReason',
  'deactivatedAt',
  'reactivationDate',
  'endDate',
  'isSet',
  'finalEmailThreeWeeksSent',
];

const lifecycleFields = (doc) => {
  const picked = {};
  LIFECYCLE_FIELDS.forEach((field) => {
    const value = doc[field];
    picked[field] = value instanceof Date ? value.toISOString() : value ?? null;
  });
  return picked;
};

/**
 * A stored user, handed back through the same field projection the controller
 * asks for. A field the query does not select is genuinely absent, which is
 * what made the resume email lose the paused-on date.
 */
const makeUserProfileModel = (stored) => {
  const saved = [];
  const model = {
    findById: jest.fn((id, projection) => {
      const doc = { _id: id, save: jest.fn(async () => saved.push(doc)) };
      const fields = projection ? projection.split(/\s+/).filter(Boolean) : Object.keys(stored);
      fields.forEach((field) => {
        if (field in stored) doc[field] = stored[field];
      });
      doc.set = (values) => Object.assign(doc, values);
      model.doc = doc;
      return Promise.resolve(doc);
    }),
    saved,
  };
  return model;
};

const storedPausedUser = (overrides = {}) => ({
  _id: USER_ID,
  firstName: 'Ann',
  lastName: 'Adams',
  email: 'ann@example.com',
  isActive: true,
  endDate: null,
  isSet: false,
  finalEmailThreeWeeksSent: false,
  reactivationDate: null,
  inactiveReason: undefined,
  deactivatedAt: null,
  teams: [],
  teamCode: 'A-TEAM',
  ...overrides,
});

const requestor = {
  requestorId: USER_ID,
  role: 'Owner',
  permissions: { frontPermissions: [] },
  email: 'owner@example.com',
};

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
  json: jest.fn(),
});

/** Pause or resume through the endpoint the UI buttons actually call. */
const callPauseEndpoint = async (stored, { status, reactivationDate }) => {
  const model = makeUserProfileModel(stored);
  const controller = userProfileController(model, {});
  const res = makeRes();
  await controller.pauseResumeUser(
    { params: { userId: USER_ID }, body: { requestor, status, reactivationDate } },
    res,
  );
  return { doc: model.doc, res };
};

/** Pause or resume through the lifecycle endpoint. */
const callLifecycleEndpoint = async (stored, body) => {
  const model = makeUserProfileModel(stored);
  const controller = userProfileController(model, {});
  const res = makeRes();
  await controller.changeUserStatus(
    { params: { userId: USER_ID }, body: { requestor, ...body } },
    res,
  );
  return { doc: model.doc, res };
};

describe('pausing and resuming a user', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date(NOW));

    // Production runs on UTC, so a date-only string parsed without an explicit
    // zone is a UTC date there, not a Pacific one.
    moment.tz.setDefault('UTC');

    mockCache.getCache.mockReturnValue(null);
    mockCache.hasCache.mockReturnValue(false);
    mockCanRequestorUpdateUser.mockResolvedValue(true);
    mockHasPermission.mockResolvedValue(true);
    mockIsProdIdentityEnforced.mockReturnValue(false);
    mockEmitProductionUserStatusChange.mockResolvedValue();
    mockUserHelper.getEmailRecipientsForStatusChange.mockResolvedValue(['admin@example.com']);
    mockUserHelper.checkTeamCodeMismatch.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    moment.tz.setDefault();
  });

  test('pausing records that the user is paused, and when', async () => {
    const { doc } = await callPauseEndpoint(storedPausedUser(), {
      status: 'Inactive',
      reactivationDate: PAUSE_UNTIL,
    });

    expect(doc.isActive).toBe(false);
    expect(doc.inactiveReason).toBe(InactiveReason.PAUSED);
    expect(moment(doc.deactivatedAt).toISOString()).toBe(NOW);
  });

  test('pausing brings the user back on the chosen day, not the day before', async () => {
    const { doc } = await callPauseEndpoint(storedPausedUser(), {
      status: 'Inactive',
      reactivationDate: PAUSE_UNTIL,
    });

    expect(moment(doc.reactivationDate).tz(COMPANY_TZ).format('YYYY-MM-DD HH:mm')).toBe(
      '2026-09-20 00:00',
    );
  });

  test('pausing clears a final day left over from an earlier separation', async () => {
    const { doc } = await callPauseEndpoint(
      storedPausedUser({ endDate: new Date('2026-10-05T06:59:59.000Z'), isSet: true }),
      { status: 'Inactive', reactivationDate: PAUSE_UNTIL },
    );

    expect(doc.endDate).toBeNull();
    expect(doc.isSet).toBe(false);
  });

  test('pausing tells management when the user is due back', async () => {
    const { doc } = await callPauseEndpoint(storedPausedUser(), {
      status: 'Inactive',
      reactivationDate: PAUSE_UNTIL,
    });

    expect(mockUserHelper.sendUserPausedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ann@example.com',
        reactivationDate: doc.reactivationDate,
        recipients: ['admin@example.com'],
      }),
    );
  });

  test('resuming clears every field the pause set', async () => {
    const { doc } = await callPauseEndpoint(
      storedPausedUser({
        isActive: false,
        inactiveReason: InactiveReason.PAUSED,
        deactivatedAt: new Date('2026-08-01T12:00:00.000Z'),
        reactivationDate: new Date('2026-09-20T07:00:00.000Z'),
      }),
      { status: 'Active' },
    );

    expect(doc.isActive).toBe(true);
    expect(doc.reactivationDate ?? null).toBeNull();
    expect(doc.deactivatedAt ?? null).toBeNull();
    expect(doc.endDate ?? null).toBeNull();
    expect(doc.inactiveReason ?? null).toBeNull();
    expect(doc.isSet).toBe(false);
    expect(doc.finalEmailThreeWeeksSent).toBe(false);
  });

  test('resuming reports the date the user was paused on', async () => {
    const pausedOn = new Date('2026-08-01T12:00:00.000Z');
    await callPauseEndpoint(
      storedPausedUser({
        isActive: false,
        inactiveReason: InactiveReason.PAUSED,
        deactivatedAt: pausedOn,
        reactivationDate: new Date('2026-09-20T07:00:00.000Z'),
      }),
      { status: 'Active' },
    );

    expect(mockUserHelper.sendUserResumedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ann@example.com', pausedOn }),
    );
  });

  test('a pause with no date is refused rather than pausing the user forever', async () => {
    const model = makeUserProfileModel(storedPausedUser());
    const controller = userProfileController(model, {});
    const res = makeRes();

    await controller.pauseResumeUser(
      { params: { userId: USER_ID }, body: { requestor, status: 'Inactive' } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(model.saved).toHaveLength(0);
  });

  test('the cached user list keeps the reactivation date after a pause', async () => {
    mockCache.hasCache.mockReturnValue(true);
    mockCache.getCache.mockReturnValue(JSON.stringify([{ _id: USER_ID, isActive: true }]));

    const { doc } = await callPauseEndpoint(storedPausedUser(), {
      status: 'Inactive',
      reactivationDate: PAUSE_UNTIL,
    });

    const cached = JSON.parse(mockCache.setCache.mock.calls[0][1])[0];
    expect(cached.isActive).toBe(false);
    expect(moment(cached.reactivationDate).toISOString()).toBe(
      moment(doc.reactivationDate).toISOString(),
    );
  });
});

describe('the two pause implementations agree', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date(NOW));
    moment.tz.setDefault('UTC');

    mockCache.getCache.mockReturnValue(null);
    mockCache.hasCache.mockReturnValue(false);
    mockCanRequestorUpdateUser.mockResolvedValue(true);
    mockHasPermission.mockResolvedValue(true);
    mockIsProdIdentityEnforced.mockReturnValue(false);
    mockEmitProductionUserStatusChange.mockResolvedValue();
    mockUserHelper.getEmailRecipientsForStatusChange.mockResolvedValue(['admin@example.com']);
    mockUserHelper.checkTeamCodeMismatch.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    moment.tz.setDefault();
  });

  test('a pause writes the same lifecycle fields whichever endpoint runs it', async () => {
    const stored = storedPausedUser();

    const legacy = await callPauseEndpoint(stored, {
      status: 'Inactive',
      reactivationDate: PAUSE_UNTIL,
    });
    const lifecycle = await callLifecycleEndpoint(stored, {
      action: UserStatusOperations.PAUSE,
      reactivationDate: PAUSE_UNTIL,
    });

    expect(lifecycleFields(legacy.doc)).toEqual(lifecycleFields(lifecycle.doc));
  });

  test('a resume writes the same lifecycle fields whichever endpoint runs it', async () => {
    const stored = storedPausedUser({
      isActive: false,
      inactiveReason: InactiveReason.PAUSED,
      deactivatedAt: new Date('2026-08-01T12:00:00.000Z'),
      reactivationDate: new Date('2026-09-20T07:00:00.000Z'),
    });

    const legacy = await callPauseEndpoint(stored, { status: 'Active' });
    const lifecycle = await callLifecycleEndpoint(stored, {
      action: UserStatusOperations.ACTIVATE,
    });

    expect(lifecycleFields(legacy.doc)).toEqual(lifecycleFields(lifecycle.doc));
  });
});
