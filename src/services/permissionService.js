const logUserPermissionChangeByAccount = require('../utilities/logUserPermissionChangeByAccount');
const { hasPermission, canRequestorUpdateUser } = require('../utilities/permissions');
const logger = require('../startup/logger');
const cacheClosure = require('../utilities/nodeCache');
const userHelper = require('../helpers/userHelper')();

class PermissionService {
  constructor(UserProfile) {
    this.UserProfile = UserProfile;
    this.cache = cacheClosure();
  }

  static validatePermissionsData(permissions) {
    return permissions && typeof permissions === 'object';
  }

  static async checkUpdateAuthorization(requestor, userId, UserProfile) {
    const hasUpdatePermission = await hasPermission(requestor, 'putUserProfilePermissions');
    if (!hasUpdatePermission) {
      return { authorized: false, error: 'You are not authorized to update user permissions' };
    }

    // Special case: Owners with addDeleteEditOwners permission can update other Owners' permissions
    const hasAddDeleteEditOwnersPermission = await hasPermission(requestor, 'addDeleteEditOwners');
    if (hasAddDeleteEditOwnersPermission) {
      const targetUser = await UserProfile.findById(userId).select('role').lean();
      if (targetUser && targetUser.role === 'Owner') {
        // Allow Owner with addDeleteEditOwners permission to update other Owners' permissions
        return { authorized: true };
      }
    }

    const canEditProtectedAccount = await canRequestorUpdateUser(requestor.requestorId, userId);

    if (!canEditProtectedAccount) {
      logger.logInfo(
        `Unauthorized attempt to update permissions for protected account. Requestor: ${requestor.requestorId} Target: ${userId}`,
      );
      return { authorized: false, error: 'You are not authorized to update this user' };
    }

    return { authorized: true };
  }

  async findUserById(userId) {
    let user;
    try {
      user = await this.UserProfile.findById(userId);
    } catch (findError) {
      const err = new Error('Invalid user id');
      err.statusCode = 400;
      throw err;
    }
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return user;
  }

  static updateUserPermissions(user, permissions) {
    let existing = {};
    try {
      if (user.permissions) {
        existing =
          typeof user.permissions.toObject === 'function'
            ? user.permissions.toObject()
            : user.permissions;
      }
    } catch (_) {
      existing = user.permissions || {};
    }
    const merged = {
      isAcknowledged: Boolean(permissions.isAcknowledged),
      frontPermissions: Array.isArray(permissions.frontPermissions)
        ? permissions.frontPermissions
        : (existing.frontPermissions || []),
      backPermissions: Array.isArray(permissions.backPermissions)
        ? permissions.backPermissions
        : (existing.backPermissions || []),
      removedDefaultPermissions: Array.isArray(permissions.removedDefaultPermissions)
        ? permissions.removedDefaultPermissions
        : (existing.removedDefaultPermissions || []),
    };
    user.permissions = merged;
    user.lastModifiedDate = Date.now();
  }

  updateUserCache(userId) {
    this.cache.removeCache(`user-${userId}`);

    const isUserInCache = this.cache.hasCache('allusers');
    if (isUserInCache) {
      const allUserData = JSON.parse(this.cache.getCache('allusers'));
      const userIdx = allUserData.findIndex((users) => users._id === userId);

      if (userIdx !== -1) {
        const userData = allUserData[userIdx];
        allUserData.splice(userIdx, 1, userData);
        this.cache.setCache('allusers', JSON.stringify(allUserData));
      }
    }
  }

  static async notifyInfringements(originalInfringements, results) {
    try {
      if (!results) return;

      const currentInfringements = results.infringements;

      if (!currentInfringements) return;

      const safeOriginal =
        originalInfringements && typeof originalInfringements.toObject === 'function'
          ? originalInfringements
          : currentInfringements;

      await userHelper.notifyInfringements(
        safeOriginal,
        currentInfringements,
        results.firstName,
        results.lastName,
        results.email,
        results.role,
        results.startDate,
        results.jobTitle?.[0],
        results.weeklycommittedHours,
      );
    } catch (error) {
      logger.logException(error, 'Error notifying infringements after permission update');
    }
  }

  async handlePostSaveOperations(req, user, originalInfringements, results) {
    await PermissionService.notifyInfringements(originalInfringements, results);
    await logUserPermissionChangeByAccount(req, user);
    this.updateUserCache(user._id.toString());
  }

  async updatePermissions(userId, permissions, req) {
    if (!PermissionService.validatePermissionsData(permissions)) {
      const err = new Error('Invalid permissions data');
      err.statusCode = 400;
      throw err;
    }

    const requestor = req.body?.requestor;
    if (!requestor || !requestor.requestorId) {
      const err = new Error('Requestor not found. Ensure request is authenticated.');
      err.statusCode = 401;
      throw err;
    }

    const authResult = await PermissionService.checkUpdateAuthorization(
      requestor,
      userId,
      this.UserProfile,
    );
    if (!authResult.authorized) {
      const error = new Error(authResult.error);
      error.statusCode = 403;
      throw error;
    }

    // Find the user
    const user = await this.findUserById(userId);
    const originalInfringements = user.infringements || [];

    // Update permissions
    PermissionService.updateUserPermissions(user, permissions);

    // Save the user
    const results = await user.save();

    // Handle post-save operations (logging, cache); don't fail the update if these throw
    try {
      await this.handlePostSaveOperations(req, user, originalInfringements, results);
    } catch (postSaveError) {
      logger.logException(postSaveError, 'Post-save operations failed after permission update');
    }

    return {
      message: 'Permissions updated successfully',
      _id: user._id,
      permissions: user.permissions,
    };
  }
}

module.exports = PermissionService;
