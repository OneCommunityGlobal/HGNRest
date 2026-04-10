const mongoose = require('mongoose');

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
jest.mock('../../helpers/dashboardhelper', () => () => ({}));
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
jest.mock('puppeteer', () => ({}));
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
  lastWeekTangibleHrs: 10,
  savedTangibleHrs: [10],
  personalBestMaxHrs: 0,
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
});

/* =======================
   TESTS
   ======================= */

describe('checkPersonalMax', () => {
  // 1. No master badge in DB — should bail out early
  test('does nothing if no master Personal Max badge exists', async () => {
    badge.find.mockResolvedValue([]);
    const user = makeUser();
    await checkPersonalMax(personId, user, []);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
    expect(userProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  // 2. New user — no badge yet, first week logging hours
  test('adds badge for new user and sets initial personal max', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 10,
      savedTangibleHrs: [10],
      personalBestMaxHrs: 0,
    });
    await checkPersonalMax(personId, user, []);
    // badge should be added
    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
    // record should be set since previousMax = 0 and lastWeek = 10
    expect(userProfile.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: personId }),
      expect.objectContaining({ $set: expect.objectContaining({ personalBestMaxHrs: 10 }) }),
    );
  });

  // 3. New user logs 0 hours — badge added but no record set
  test('adds badge for new user but does not set record if 0 hours logged', async () => {
    const user = makeUser({ lastWeekTangibleHrs: 0, savedTangibleHrs: [0], personalBestMaxHrs: 0 });
    await checkPersonalMax(personId, user, []);
    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  // 4. Existing user breaks the record
  test('updates earnedDate and personalBestMaxHrs when record is broken', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 20,
      savedTangibleHrs: [10, 8, 15, 12, 20],
      personalBestMaxHrs: 15,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: personId }),
      expect.objectContaining({ $set: expect.objectContaining({ personalBestMaxHrs: 20 }) }),
    );
  });

  // 5. Existing user does not break the record
  test('does not update badge when record is not broken', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 10,
      savedTangibleHrs: [10, 8, 15, 12, 10],
      personalBestMaxHrs: 15,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  // 6. Existing user ties the record — should NOT update
  test('does not update badge when hours tie the previous record', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 15,
      savedTangibleHrs: [10, 8, 15, 12, 15],
      personalBestMaxHrs: 15,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  // 7. Existing user logs 0 hours
  test('does not update badge when user logs 0 hours', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 0,
      savedTangibleHrs: [10, 8, 0],
      personalBestMaxHrs: 10,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  // 8. User has duplicate Personal Max badges — duplicates removed, record not broken
  test('removes duplicate badges when record is not broken', async () => {
    const badge1 = makeBadge();
    const badge2 = makeBadge();
    const user = makeUser({
      lastWeekTangibleHrs: 5,
      savedTangibleHrs: [10, 5],
      personalBestMaxHrs: 10,
    });
    await checkPersonalMax(personId, user, [badge1, badge2]);
    // removeDupBadge calls findByIdAndUpdate with $pull
    expect(userProfile.findByIdAndUpdate).toHaveBeenCalledWith(
      personId,
      expect.objectContaining({ $pull: expect.anything() }),
      expect.anything(),
      expect.anything(),
    );
    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  // 9. User has duplicate badges AND breaks record
  test('removes duplicates and updates badge when record is broken', async () => {
    const badge1 = makeBadge();
    const badge2 = makeBadge();
    const user = makeUser({
      lastWeekTangibleHrs: 25,
      savedTangibleHrs: [10, 8, 20, 25],
      personalBestMaxHrs: 20,
    });
    await checkPersonalMax(personId, user, [badge1, badge2]);
    expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
    expect(userProfile.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: personId }),
      expect.objectContaining({ $set: expect.objectContaining({ personalBestMaxHrs: 25 }) }),
    );
  });

  // 10. Full savedTangibleHrs array (200 entries), last entry is current week
  test('correctly identifies record break with full 200-entry history', async () => {
    const history = Array(199).fill(20); // previous 199 weeks all at 20hrs
    const savedTangibleHrs = [...history, 25]; // current week = 25
    const user = makeUser({
      lastWeekTangibleHrs: 25,
      savedTangibleHrs,
      personalBestMaxHrs: 20,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: personId }),
      expect.objectContaining({ $set: expect.objectContaining({ personalBestMaxHrs: 25 }) }),
    );
  });

  // 11. Full 200-entry history, current week does NOT break record
  test('does not update when current week does not beat full 200-entry history', async () => {
    const history = Array(199).fill(20);
    history[100] = 30; // a previous week had 30hrs
    const savedTangibleHrs = [...history, 25]; // current week = 25, previous max = 30
    const user = makeUser({
      lastWeekTangibleHrs: 25,
      savedTangibleHrs,
      personalBestMaxHrs: 30,
    });
    await checkPersonalMax(personId, user, [makeBadge()]);
    expect(userProfile.updateOne).not.toHaveBeenCalled();
  });

  // 12. earnedDate is replaced (not appended) when record is broken
  test('replaces earnedDate array rather than appending', async () => {
    const user = makeUser({
      lastWeekTangibleHrs: 30,
      savedTangibleHrs: [10, 20, 30],
      personalBestMaxHrs: 20,
    });
    await checkPersonalMax(personId, user, [makeBadge({ earnedDate: ['Jan-01-25', 'Feb-01-25'] })]);
    const setArg = userProfile.updateOne.mock.calls[0][1].$set;
    expect(Array.isArray(setArg['badgeCollection.$.earnedDate'])).toBe(true);
    expect(setArg['badgeCollection.$.earnedDate']).toHaveLength(1);
  });
});
