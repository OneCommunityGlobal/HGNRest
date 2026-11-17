jest.mock('../utilities/logUserPermissionChangeByAccount', () => jest.fn());
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
  canRequestorUpdateUser: jest.fn(),
}));
jest.mock('../startup/logger', () => ({ logInfo: jest.fn(), logException: jest.fn() }));
jest.mock('../utilities/nodeCache', () => jest.fn());
jest.mock('../helpers/userHelper', () => jest.fn(() => ({ notifyInfringements: jest.fn() })));

const logPermissionChange = require('../utilities/logUserPermissionChangeByAccount');
const { hasPermission, canRequestorUpdateUser } = require('../utilities/permissions');
const logger = require('../startup/logger');
const cacheClosure = require('../utilities/nodeCache');
const userHelperFactory = require('../helpers/userHelper');
const PermissionService = require('./permissionService');

const { notifyInfringements } = userHelperFactory.mock.results[0].value;

describe('PermissionService', () => {
  const userId = 'target-user';
  const requestor = { requestorId: 'requestor-user', role: 'Administrator' };
  let UserProfile;
  let cache;
  let service;
  let user;
  let req;

  beforeEach(() => {
    jest.resetAllMocks();
    cache = {
      removeCache: jest.fn(),
      hasCache: jest.fn().mockReturnValue(false),
      getCache: jest.fn(),
      setCache: jest.fn(),
    };
    cacheClosure.mockReturnValue(cache);
    UserProfile = { findById: jest.fn() };
    user = {
      _id: userId,
      permissions: {
        frontPermissions: ['viewProfile'],
        backPermissions: ['getUserProfile'],
        removedDefaultPermissions: ['deleteUserProfile'],
      },
      save: jest.fn(),
    };
    user.save.mockResolvedValue(user);
    UserProfile.findById.mockResolvedValue(user);
    hasPermission.mockImplementation(
      async (_, permission) => permission === 'putUserProfilePermissions',
    );
    canRequestorUpdateUser.mockResolvedValue(true);
    req = { body: { requestor } };
    service = new PermissionService(UserProfile);
  });

  describe('authorization', () => {
    test('rejects updates without the permission and does not look up or save the target', async () => {
      hasPermission.mockResolvedValue(false);
      await expect(service.updatePermissions(userId, {}, req)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not authorized to update user permissions',
      });
      expect(hasPermission).toHaveBeenCalledWith(requestor, 'putUserProfilePermissions');
      expect(canRequestorUpdateUser).not.toHaveBeenCalled();
      expect(UserProfile.findById).not.toHaveBeenCalled();
      expect(user.save).not.toHaveBeenCalled();
      expect(logPermissionChange).not.toHaveBeenCalled();
    });

    test('rejects protected-account changes even when the update permission is present', async () => {
      canRequestorUpdateUser.mockResolvedValue(false);
      await expect(service.updatePermissions(userId, {}, req)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You are not authorized to update this user',
      });
      expect(canRequestorUpdateUser).toHaveBeenCalledWith(requestor.requestorId, userId);
      expect(UserProfile.findById).not.toHaveBeenCalled();
      expect(logger.logInfo).toHaveBeenCalledWith(expect.stringContaining(userId));
      expect(user.save).not.toHaveBeenCalled();
    });

    test('allows an Owner target when the requestor has the explicit owner-management permission', async () => {
      const lean = jest.fn().mockResolvedValue({ role: 'Owner' });
      const select = jest.fn().mockReturnValue({ lean });
      hasPermission.mockResolvedValue(true);
      UserProfile.findById.mockReturnValueOnce({ select });
      await expect(
        PermissionService.checkUpdateAuthorization(requestor, userId, UserProfile),
      ).resolves.toEqual({ authorized: true });
      expect(select).toHaveBeenCalledWith('role');
      expect(hasPermission).toHaveBeenCalledWith(requestor, 'addDeleteEditOwners');
      expect(canRequestorUpdateUser).not.toHaveBeenCalled();
    });

    test.each([{ role: 'Volunteer' }, null])(
      'still checks protected-account access for a non-Owner or missing target (%j)',
      async (target) => {
        hasPermission.mockResolvedValue(true);
        UserProfile.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(target) }),
        });
        canRequestorUpdateUser.mockResolvedValue(false);
        await expect(
          PermissionService.checkUpdateAuthorization(requestor, userId, UserProfile),
        ).resolves.toMatchObject({ authorized: false });
        expect(canRequestorUpdateUser).toHaveBeenCalledWith(requestor.requestorId, userId);
      },
    );
  });

  describe('input and persistence failures', () => {
    test.each([undefined, null, false, 'permissions', 1])(
      'rejects invalid input %p before access checks',
      async (input) => {
        await expect(service.updatePermissions(userId, input, req)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Invalid permissions data',
        });
        expect(hasPermission).not.toHaveBeenCalled();
        expect(user.save).not.toHaveBeenCalled();
      },
    );

    test.each([{}, { body: {} }, { body: { requestor: {} } }])(
      'rejects missing authenticated identity (%j)',
      async (request) => {
        await expect(service.updatePermissions(userId, {}, request)).rejects.toMatchObject({
          statusCode: 401,
        });
        expect(hasPermission).not.toHaveBeenCalled();
        expect(UserProfile.findById).not.toHaveBeenCalled();
      },
    );

    test('returns a not-found error without post-save side effects', async () => {
      UserProfile.findById.mockResolvedValue(null);
      await expect(service.updatePermissions(userId, {}, req)).rejects.toMatchObject({
        statusCode: 404,
        message: 'User not found',
      });
      expect(logPermissionChange).not.toHaveBeenCalled();
      expect(cache.removeCache).not.toHaveBeenCalled();
    });

    test('reports an invalid lookup id', async () => {
      UserProfile.findById.mockRejectedValue(new Error('Cast to ObjectId failed'));
      await expect(service.updatePermissions(userId, {}, req)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid user id',
      });
      expect(user.save).not.toHaveBeenCalled();
    });

    test('propagates save failures without auditing, notifications, or cache changes', async () => {
      const error = new Error('Database unavailable');
      user.save.mockRejectedValue(error);
      await expect(service.updatePermissions(userId, {}, req)).rejects.toBe(error);
      expect(notifyInfringements).not.toHaveBeenCalled();
      expect(logPermissionChange).not.toHaveBeenCalled();
      expect(cache.removeCache).not.toHaveBeenCalled();
    });
  });

  describe('permission updates', () => {
    test('saves supplied permissions, returns them, and audits only after saving', async () => {
      const changes = {
        isAcknowledged: true,
        frontPermissions: ['viewReports'],
        backPermissions: ['getReports'],
        removedDefaultPermissions: ['editProfile'],
      };
      await expect(service.updatePermissions(userId, changes, req)).resolves.toEqual({
        message: 'Permissions updated successfully',
        _id: userId,
        permissions: changes,
      });
      expect(user.save).toHaveBeenCalledTimes(1);
      expect(logPermissionChange).toHaveBeenCalledWith(req, user);
      expect(user.save.mock.invocationCallOrder[0]).toBeLessThan(
        logPermissionChange.mock.invocationCallOrder[0],
      );
      expect(cache.removeCache).toHaveBeenCalledWith(`user-${userId}`);
      expect(changes).toEqual(user.permissions);
    });

    test('preserves omitted permission arrays and records the modification time', async () => {
      const existing = { ...user.permissions };
      const now = 1794931200000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      try {
        await service.updatePermissions(userId, { isAcknowledged: true }, req);
        expect(user.permissions).toEqual({ ...existing, isAcknowledged: true });
        expect(user.lastModifiedDate).toBe(now);
      } finally {
        jest.restoreAllMocks();
      }
    });

    test('accepts empty arrays to explicitly clear existing permissions', async () => {
      const changes = {
        isAcknowledged: false,
        frontPermissions: [],
        backPermissions: [],
        removedDefaultPermissions: [],
      };
      await service.updatePermissions(userId, changes, req);
      expect(user.permissions).toEqual(changes);
    });

    test('preserves existing arrays when supplied replacement fields are not arrays', async () => {
      const existing = { ...user.permissions };
      await service.updatePermissions(
        userId,
        {
          isAcknowledged: false,
          frontPermissions: null,
          backPermissions: 'admin',
          removedDefaultPermissions: {},
        },
        req,
      );
      expect(user.permissions).toEqual({ ...existing, isAcknowledged: false });
    });

    test('initializes missing permission arrays', async () => {
      delete user.permissions;
      await service.updatePermissions(userId, {}, req);
      expect(user.permissions).toEqual({
        isAcknowledged: false,
        frontPermissions: [],
        backPermissions: [],
        removedDefaultPermissions: [],
      });
    });

    test('reads existing permissions from a Mongoose subdocument', async () => {
      const existing = { ...user.permissions };
      user.permissions = { toObject: jest.fn().mockReturnValue(existing) };
      await service.updatePermissions(userId, { isAcknowledged: true }, req);
      expect(user.permissions).toEqual({ ...existing, isAcknowledged: true });
    });

    test('falls back to existing permissions when subdocument conversion fails', async () => {
      const existing = { ...user.permissions };
      user.permissions.toObject = () => {
        throw new Error('Conversion failed');
      };
      await service.updatePermissions(userId, {}, req);
      expect(user.permissions).toEqual({ ...existing, isAcknowledged: false });
    });
  });

  describe('post-save behavior', () => {
    test('passes saved user details and original infringement subdocument to the notifier', async () => {
      const original = { toObject: jest.fn() };
      const saved = {
        ...user,
        infringements: [{ reason: 'Updated' }],
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        role: 'Volunteer',
        startDate: '2026-01-01',
        jobTitle: ['Developer'],
        weeklycommittedHours: 10,
      };
      user.infringements = original;
      user.save.mockResolvedValue(saved);
      await service.updatePermissions(userId, {}, req);
      expect(notifyInfringements).toHaveBeenCalledWith(
        original,
        saved.infringements,
        'Test',
        'User',
        'test@example.com',
        'Volunteer',
        '2026-01-01',
        'Developer',
        10,
      );
    });

    test('handles missing original infringements and job title', async () => {
      user.infringements = [];
      await service.updatePermissions(userId, {}, req);
      expect(notifyInfringements).toHaveBeenCalledWith(
        [],
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    test.each([undefined, {}])(
      'does not notify when saved infringement information is absent (%p)',
      async (saved) => {
        await PermissionService.notifyInfringements([], saved);
        expect(notifyInfringements).not.toHaveBeenCalled();
      },
    );

    test('keeps the successful update and audit when notification fails', async () => {
      user.infringements = [];
      const error = new Error('Notification unavailable');
      notifyInfringements.mockRejectedValue(error);
      await expect(service.updatePermissions(userId, {}, req)).resolves.toMatchObject({
        _id: userId,
      });
      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'Error notifying infringements after permission update',
      );
      expect(logPermissionChange).toHaveBeenCalledWith(req, user);
      expect(cache.removeCache).toHaveBeenCalledWith(`user-${userId}`);
    });

    test('keeps the saved update when audit logging fails', async () => {
      const error = new Error('Audit unavailable');
      logPermissionChange.mockRejectedValue(error);
      await expect(service.updatePermissions(userId, {}, req)).resolves.toMatchObject({
        _id: userId,
      });
      expect(user.save).toHaveBeenCalledTimes(1);
      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'Post-save operations failed after permission update',
      );
    });

    test('keeps the saved update when cache invalidation fails', async () => {
      const error = new Error('Cache unavailable');
      cache.removeCache.mockImplementation(() => {
        throw error;
      });
      await expect(service.updatePermissions(userId, {}, req)).resolves.toMatchObject({
        _id: userId,
      });
      expect(logger.logException).toHaveBeenCalledWith(
        error,
        'Post-save operations failed after permission update',
      );
    });

    test('does not create an all-users cache on a cache miss', () => {
      service.updateUserCache(userId);
      expect(cache.removeCache).toHaveBeenCalledWith(`user-${userId}`);
      expect(cache.getCache).not.toHaveBeenCalled();
      expect(cache.setCache).not.toHaveBeenCalled();
    });

    test('leaves a cached list without the target unchanged', () => {
      cache.hasCache.mockReturnValue(true);
      cache.getCache.mockReturnValue(JSON.stringify([{ _id: 'other-user' }]));
      service.updateUserCache(userId);
      expect(cache.setCache).not.toHaveBeenCalled();
      expect(cache.removeCache).toHaveBeenCalledWith(`user-${userId}`);
    });

    test('retains other users and list ordering when the target is cached', () => {
      const users = [{ _id: 'first' }, { _id: userId }, { _id: 'last' }];
      cache.hasCache.mockReturnValue(true);
      cache.getCache.mockReturnValue(JSON.stringify(users));
      service.updateUserCache(userId);
      expect(cache.setCache).toHaveBeenCalledWith('allusers', JSON.stringify(users));
      expect(cache.removeCache).toHaveBeenCalledWith(`user-${userId}`);
    });
  });
});
