const mongoose = require('mongoose');
const moment = require('moment-timezone');

/* =======================
   MOCKS (MUST COME FIRST)
   ======================= */

jest.mock('../../models/userProfile', () => ({
  updateOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../../models/badge', () => ({
  find: jest.fn(),
}));

// Mock all heavy dependencies userHelper pulls in
jest.mock('../../models/team', () => ({}));
jest.mock('../../models/timeentry', () => ({}));
jest.mock('../../models/timeOffRequest', () => ({}));
jest.mock('../../models/profileInitialSetupToken', () => ({}));
jest.mock('../../models/BlueSquareEmailAssignment', () => ({}));
const mockLaborThisWeek = jest.fn();

jest.mock('../../helpers/dashboardhelper', () => () => ({
  laborthisweek: mockLaborThisWeek,
}));
jest.mock('../../helpers/helperModels/myTeam', () => ({}));
jest.mock('../../utilities/emailSender', () => ({}));
jest.mock('../../utilities/timeUtils', () => ({}));
jest.mock('../../services/notificationService', () => ({}));
jest.mock('../../constants/message', () => ({ NEW_USER_BLUE_SQUARE_NOTIFICATION_MESSAGE: '' }));
jest.mock('../../utilities/nodeCache', () => () => ({
  hasCache: jest.fn(() => false),
  removeCache: jest.fn(),
  getCache: jest.fn(),
  setCache: jest.fn(),
}));
jest.mock('../../startup/logger', () => ({
  logException: jest.fn(),
}));
jest.mock('puppeteer', () => ({}), { virtual: true });
jest.mock('sharp', () => ({}));

/* =======================
   IMPORTS AFTER MOCKS
   ======================= */

const userProfile = require('../../models/userProfile');
const badge = require('../../models/badge');
const userHelperFactory = require('../userHelper');

const { checkPersonalMax } = userHelperFactory();

/* =======================
   HELPERS
   ======================= */

const masterBadgeId = new mongoose.Types.ObjectId();
const personId = new mongoose.Types.ObjectId();

const makeBadge = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  badge: { _id: masterBadgeId, type: 'Personal Max' },
  count: 1,
  earnedDate: ['Jan-01-25'],
  ...overrides,
});

const makeUser = (overrides = {}) => ({
  createdDate: moment().tz('America/Los_Angeles').format('YYYY-MM-DD'),
  lastWeekTangibleHrs: 10,
  savedTangibleHrs: [10],
  personalBestMaxHrs: 0,
  save: jest.fn().mockResolvedValue({}),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  badge.find.mockResolvedValue([{ _id: masterBadgeId, type: 'Personal Max' }]);
  userProfile.updateOne.mockResolvedValue({});
  userProfile.findByIdAndUpdate.mockImplementation((id, update, cb) => {
    if (typeof cb === 'function') cb(null);
    return Promise.resolve({});
  });
  mockLaborThisWeek.mockResolvedValue([{ timeSpent_hrs: 0 }]);
});

/* =======================
   TESTS
   ======================= */

describe('checkPersonalMax', () => {
  test('does nothing if no master Personal Max badge exists', async () => {
    badge.find.mockResolvedValue([]);
    const user = makeUser();
    await checkPersonalMax(personId, user, []);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(user.save).toHaveBeenCalled();
  });

  test('adds badge for new user and persists personal max', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 10,
      savedTangibleHrs: [10],
      personalBestMaxHrs: 0,
    });
    await checkPersonalMax(personId, user, []);
    expect(userProfile.findByIdAndUpdate).toHaveBeenCalledWith(
      personId,
      expect.objectContaining({
        $push: expect.objectContaining({
          badgeCollection: expect.objectContaining({
            badge: masterBadgeId,
          }),
        }),
      }),
      expect.any(Function),
    );
    expect(user.personalBestMaxHrs).toBe(10);
    expect(user.save).toHaveBeenCalled();
  });

  test('adds badge for new user but keeps personal max at 0 when no hours logged', async () => {
    const user = makeUser({ lastWeekTangibleHrs: 0, savedTangibleHrs: [0], personalBestMaxHrs: 0 });
    await checkPersonalMax(personId, user, []);
    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
    expect(user.personalBestMaxHrs).toBe(0);
    expect(user.save).toHaveBeenCalled();
  });

  test('increments badge count when increase conditions are met', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 20,
      savedTangibleHrs: [10, 8, 15, 12, 25],
      personalBestMaxHrs: 15,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).toHaveBeenCalledWith(
      { _id: personId, 'badgeCollection.badge': masterBadgeId },
      expect.objectContaining({
        $inc: { 'badgeCollection.$.count': 1 },
        $push: { 'badgeCollection.$.earnedDate': expect.any(String) },
      }),
      expect.any(Function),
    );
    expect(user.personalBestMaxHrs).toBe(25);
    expect(user.save).toHaveBeenCalled();
  });

  test('does not increment badge count when increase conditions are not met', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 10,
      savedTangibleHrs: [10, 8, 15, 12, 10],
      personalBestMaxHrs: 15,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
    expect(user.personalBestMaxHrs).toBe(15);
    expect(user.save).toHaveBeenCalled();
  });

  test('does not increment badge count when hours tie the previous record', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 15,
      savedTangibleHrs: [10, 8, 15, 12, 15],
      personalBestMaxHrs: 15,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
    expect(user.personalBestMaxHrs).toBe(15);
  });

  test('does not increment badge count when user logs 0 hours', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 0,
      savedTangibleHrs: [10, 8, 0],
      personalBestMaxHrs: 10,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
    expect(user.personalBestMaxHrs).toBe(10);
  });

  test('keeps the first Personal Max badge when duplicates are present', async () => {
    const badge1 = makeBadge();
    const badge2 = makeBadge({ _id: new mongoose.Types.ObjectId() });
    const user = makeUser({
      lastWeekTangibleHrs: 5,
      savedTangibleHrs: [10, 5],
      personalBestMaxHrs: 10,
    });
    await checkPersonalMax(personId, user, [badge1, badge2]);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
    expect(user.save).toHaveBeenCalled();
  });

  test('still increments badge count when duplicates are present and conditions are met', async () => {
    const badge1 = makeBadge();
    const badge2 = makeBadge({ _id: new mongoose.Types.ObjectId() });
    const user = makeUser({
      lastWeekTangibleHrs: 25,
      savedTangibleHrs: [10, 8, 20, 30],
      personalBestMaxHrs: 20,
    });
    await checkPersonalMax(personId, user, [badge1, badge2]);
    expect(userProfile.updateOne).toHaveBeenCalled();
    expect(user.personalBestMaxHrs).toBe(30);
  });

  test('persists the max hours from a full 200-entry history', async () => {
    const history = Array(199).fill(20);
    const savedTangibleHrs = [...history, 25];
    const user = makeUser({
      lastWeekTangibleHrs: 25,
      savedTangibleHrs,
      personalBestMaxHrs: 20,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(user.personalBestMaxHrs).toBe(25);
    expect(user.save).toHaveBeenCalled();
  });

  test('preserves the previous max when current week does not beat full 200-entry history', async () => {
    const history = Array(199).fill(20);
    history[100] = 30;
    const savedTangibleHrs = [...history, 25];
    const user = makeUser({
      lastWeekTangibleHrs: 25,
      savedTangibleHrs,
      personalBestMaxHrs: 30,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
    expect(user.personalBestMaxHrs).toBe(30);
  });

  test('pushes a new earnedDate entry when badge count increases', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 30,
      savedTangibleHrs: [10, 20, 35],
      personalBestMaxHrs: 20,
    });
    await checkPersonalMax(personId, user, [makeBadge({ earnedDate: ['Jan-01-25', 'Feb-01-25'] })]);
    const updateArg = userProfile.updateOne.mock.calls[0][1];
    expect(updateArg.$push['badgeCollection.$.earnedDate']).toEqual(expect.any(String));
  });
});
