/**
 * @jest-environment node
 */

jest.mock('../models/userProfile');
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));
jest.mock('../utilities/nodeCache', () => {
  const mockCache = {
    getCache: jest.fn(),
    setCache: jest.fn(),
    removeCache: jest.fn(),
    hasCache: jest.fn(() => false),
  };
  return jest.fn(() => mockCache);
});
jest.mock('../helpers/userHelper', () =>
  jest.fn(() => ({
    awardNewBadges: jest.fn(),
  })),
);

const UserProfile = require('../models/userProfile');
const { hasPermission } = require('../utilities/permissions');
const cacheClosure = require('../utilities/nodeCache');
const badgeControllerFactory = require('./badgeController');

const cache = cacheClosure();
const controller = badgeControllerFactory({});

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
});

describe('badgeController - assignBadgesToMultipleUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    cache.hasCache.mockReturnValue(false);
  });

  it('returns 403 when the requestor lacks the assignBadges permission', async () => {
    hasPermission.mockResolvedValue(false);
    const req = { body: { requestor: {}, userIds: ['u1'], selectedBadges: ['b1'] } };
    const res = makeRes();

    await controller.assignBadgesToMultipleUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith('You are not authorized to assign badges.');
    expect(UserProfile.findById).not.toHaveBeenCalled();
  });

  it('returns 400 when userIds is missing or not a non-empty array', async () => {
    const res = makeRes();
    await controller.assignBadgesToMultipleUsers({ body: { selectedBadges: ['b1'] } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('userIds must be a non-empty array.');

    const res2 = makeRes();
    await controller.assignBadgesToMultipleUsers(
      { body: { userIds: [], selectedBadges: ['b1'] } },
      res2,
    );
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when selectedBadges is missing or not a non-empty array', async () => {
    const res = makeRes();
    await controller.assignBadgesToMultipleUsers({ body: { userIds: ['u1'] } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('selectedBadges must be a non-empty array.');

    const res2 = makeRes();
    await controller.assignBadgesToMultipleUsers(
      { body: { userIds: ['u1'], selectedBadges: [] } },
      res2,
    );
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it('adds a new badge entry for a user who does not already have it and bumps badgeCount', async () => {
    const save = jest.fn().mockResolvedValue(true);
    const record = { badgeCount: 2, badgeCollection: [], save };
    UserProfile.findById.mockResolvedValue(record);
    cache.hasCache.mockReturnValue(true);

    const req = { body: { requestor: {}, userIds: ['u1'], selectedBadges: ['b1', 'b2'] } };
    const res = makeRes();

    await controller.assignBadgesToMultipleUsers(req, res);

    expect(record.badgeCollection).toHaveLength(2);
    expect(record.badgeCollection[0]).toMatchObject({ badge: 'b1', count: 1, featured: false });
    expect(record.badgeCount).toBe(4); // 2 existing + 2 assigned
    expect(cache.removeCache).toHaveBeenCalledWith('user-u1');
    expect(save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Badges assigned successfully.',
        results: [{ userId: 'u1', success: true }],
      }),
    );
  });

  it('increments the count of a badge the user already has instead of duplicating it', async () => {
    const save = jest.fn().mockResolvedValue(true);
    const record = {
      badgeCollection: [{ badge: 'b1', count: 3, earnedDate: ['old'], lastModified: 0 }],
      save,
    };
    UserProfile.findById.mockResolvedValue(record);

    const req = { body: { requestor: {}, userIds: ['u1'], selectedBadges: ['b1'] } };
    const res = makeRes();

    await controller.assignBadgesToMultipleUsers(req, res);

    expect(record.badgeCollection).toHaveLength(1);
    expect(record.badgeCollection[0].count).toBe(4);
    expect(record.badgeCollection[0].earnedDate).toHaveLength(2);
    expect(record.badgeCount).toBe(1); // undefined -> 0 + 1 assigned
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('initializes badgeCollection when the user record has none', async () => {
    const save = jest.fn().mockResolvedValue(true);
    const record = { save };
    UserProfile.findById.mockResolvedValue(record);

    const req = { body: { requestor: {}, userIds: ['u1'], selectedBadges: ['b1'] } };
    const res = makeRes();

    await controller.assignBadgesToMultipleUsers(req, res);

    expect(Array.isArray(record.badgeCollection)).toBe(true);
    expect(record.badgeCollection).toHaveLength(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('reports per-user failures but still returns 200 when at least one user succeeds', async () => {
    const save = jest.fn().mockResolvedValue(true);
    UserProfile.findById
      .mockResolvedValueOnce(null) // u1: not found
      .mockResolvedValueOnce({ badgeCollection: [], save }); // u2: ok

    const req = { body: { requestor: {}, userIds: ['u1', 'u2'], selectedBadges: ['b1'] } };
    const res = makeRes();

    await controller.assignBadgesToMultipleUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [
          { userId: 'u1', success: false, reason: 'User not found' },
          { userId: 'u2', success: true },
        ],
      }),
    );
  });

  it('returns 400 when every user fails', async () => {
    UserProfile.findById.mockResolvedValue(null);

    const req = { body: { requestor: {}, userIds: ['u1', 'u2'], selectedBadges: ['b1'] } };
    const res = makeRes();

    await controller.assignBadgesToMultipleUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to assign badges to any user.' }),
    );
  });

  it('captures a save error as a per-user failure reason', async () => {
    const save = jest.fn().mockRejectedValue(new Error('write failed'));
    UserProfile.findById.mockResolvedValue({ badgeCollection: [], save });

    const req = { body: { requestor: {}, userIds: ['u1'], selectedBadges: ['b1'] } };
    const res = makeRes();

    await controller.assignBadgesToMultipleUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [{ userId: 'u1', success: false, reason: 'write failed' }],
      }),
    );
  });
});
