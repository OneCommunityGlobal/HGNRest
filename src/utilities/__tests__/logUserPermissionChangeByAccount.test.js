const UserPermissionChangeLog = require('../../models/userPermissionChangeLog');
const UserProfile = require('../../models/userProfile');
const logUserPermissionChangeByAccount = require('../logUserPermissionChangeByAccount');
const { mockReq } = require('../../test');

jest.mock('moment-timezone');
jest.mock('../../models/userPermissionChangeLog');
jest.mock('../../models/userProfile');

describe('logUserPermissionChangeByAccount', () => {
  const user = {
    firstName: 'Jane',
    lastName: 'Smith',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns when permissions are missing', async () => {
    const req = {
      ...mockReq,
      body: {
        ...mockReq.body,
        permissions: undefined,
      },
    };

    const res = await logUserPermissionChangeByAccount(req, user);
    expect(res).toBeUndefined();
  });

  test('handles error during latest document retrieval', async () => {
    const req = {
      ...mockReq,
      body: {
        ...mockReq.body,
        permissions: {
          frontPermissions: ['addDeleteEditOwners', 'postTeam'],
          backPermissions: ['postTeam'],
        },
      },
    };

    jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        email: 'requestor@example.com',
      }),
    }));

    const findOneSpy = jest
      .spyOn(UserPermissionChangeLog, 'findOne')
      .mockImplementationOnce(() => ({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockImplementationOnce((callback) => {
          callback(new Error('No document found'));
        }),
      }));

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    await logUserPermissionChangeByAccount(req, user);
    expect(findOneSpy).toHaveBeenCalledWith({
      userId: req.params.userId,
    });

    expect(consoleError).toHaveBeenCalledWith(
      'Error logging permission change:',
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  test('creates new document when no previous log for user is found', async () => {
    const req = {
      ...mockReq,
      body: {
        ...mockReq.body,
        permissions: {
          frontPermissions: ['addDeleteEditOwners', 'postTeam'],
          backPermissions: ['postTeam'],
        },
        reason: 'Permissions Changed',
      },
    };

    jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        email: 'requestor@example.com',
      }),
    }));

    jest.spyOn(UserPermissionChangeLog, 'findOne').mockImplementationOnce(() => ({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementationOnce((callback) => {
        callback(null, null);
      }),
    }));

    const saveSpy = jest.spyOn(UserPermissionChangeLog.prototype, 'save').mockResolvedValueOnce({
      individualName: `INDIVIDUAL: Jane Smith`,
      permissions: ['addDeleteEditOwners', 'postTeam'],
      removedRolePermissions: [],
      permissionsAdded: ['addDeleteEditOwners', 'postTeam'],
      permissionsRemoved: [],
      requestorRole: req.body.requestor.role,
      reason: req.body.reason,
      requestorEmail: 'requestor@example.com',
    });

    await logUserPermissionChangeByAccount(req, user);
    expect(saveSpy).toHaveBeenCalled();

    const savedLog = saveSpy.mock.instances[0].toObject();
    expect(savedLog.userId.toString()).toBe(req.params.userId);
    expect(savedLog.logDateTime).toEqual(expect.any(String));
    expect(savedLog).toMatchObject({
      individualName: 'INDIVIDUAL: Jane Smith',
      permissions: ['addDeleteEditOwners', 'postTeam'],
      removedRolePermissions: [],
      permissionsAdded: ['addDeleteEditOwners', 'postTeam'],
      permissionsRemoved: [],
      requestorRole: req.body.requestor.role,
      reason: req.body.reason,
      requestorEmail: 'requestor@example.com',
    });
  });

  test('creates new document for user', async () => {
    const req = {
      ...mockReq,
      body: {
        ...mockReq.body,
        permissions: {
          frontPermissions: ['addDeleteEditOwners', 'postTeam'],
          removedDefaultPermissions: ['seeAllUsers'],
          backPermissions: ['postTeam'],
        },
        reason: 'Permissions Changed',
      },
    };

    jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        email: 'requestor@example.com',
      }),
    }));

    const priorLog = {
      permissions: ['addDeleteEditOwners'],
      removedRolePermissions: ['seeAllUsers'],
    };

    jest.spyOn(UserPermissionChangeLog, 'findOne').mockImplementationOnce(() => ({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementationOnce((callback) => {
        callback(null, priorLog);
      }),
    }));

    const saveSpy = jest.spyOn(UserPermissionChangeLog.prototype, 'save').mockResolvedValueOnce({
      individualName: `INDIVIDUAL: Jane Smith`,
      permissions: ['addDeleteEditOwners', 'postTeam'],
      removedRolePermissions: [],
      permissionsAdded: ['postTeam'],
      permissionsRemoved: [],
      requestorRole: req.body.requestor.role,
      reason: req.body.reason,
      requestorEmail: 'requestor@example.com',
    });

    await logUserPermissionChangeByAccount(req, user);
    expect(saveSpy).toHaveBeenCalled();

    const savedLog = saveSpy.mock.instances[0].toObject();
    expect(savedLog.userId.toString()).toBe(req.params.userId);
    expect(savedLog.logDateTime).toEqual(expect.any(String));
    expect(savedLog).toMatchObject({
      individualName: 'INDIVIDUAL: Jane Smith',
      permissions: ['addDeleteEditOwners', 'postTeam'],
      removedRolePermissions: ['seeAllUsers'],
      permissionsAdded: ['postTeam'],
      permissionsRemoved: [],
      requestorRole: req.body.requestor.role,
      reason: req.body.reason,
      requestorEmail: 'requestor@example.com',
    });
  });

  test('return early if no new changes in permissions list from last update and no role change', async () => {
    const req = {
      ...mockReq,
      body: {
        ...mockReq.body,
        permissions: {
          frontPermissions: ['addDeleteEditOwners', 'postTeam'],
          removedDefaultPermissions: ['seeAllUsers'],
          backPermissions: ['postTeam'],
        },
        reason: 'Permissions Changed',
      },
    };

    jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        email: 'requestor@example.com',
      }),
    }));

    const priorLog = {
      permissions: ['addDeleteEditOwners', 'postTeam'],
      removedRolePermissions: ['seeAllUsers'],
    };

    jest.spyOn(UserPermissionChangeLog, 'findOne').mockImplementationOnce(() => ({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementationOnce((callback) => {
        callback(null, priorLog);
      }),
    }));

    const saveSpy = jest.spyOn(UserPermissionChangeLog.prototype, 'save').mockResolvedValueOnce({});

    const res = await logUserPermissionChangeByAccount(req, user);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(res).toBeUndefined();
  });

  test('return for edge case of no changes in permissions for user with no previous change log', async () => {
    const req = {
      ...mockReq,
      body: {
        ...mockReq.body,
        permissions: {
          frontPermissions: [],
          removedDefaultPermissions: [],
          backPermissions: [],
        },
        reason: 'Permissions Changed',
      },
    };

    jest.spyOn(UserProfile, 'findById').mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        email: 'requestor@example.com',
      }),
    }));

    jest.spyOn(UserPermissionChangeLog, 'findOne').mockImplementationOnce(() => ({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementationOnce((callback) => {
        callback(null, null);
      }),
    }));

    const saveSpy = jest.spyOn(UserPermissionChangeLog.prototype, 'save').mockResolvedValueOnce({});

    const res = await logUserPermissionChangeByAccount(req, user);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(res).toBeUndefined();
  });
});
