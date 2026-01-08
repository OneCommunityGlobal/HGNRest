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
    const user = await this.UserProfile.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  static updateUserPermissions(user, permissions) {
    user.permissions = {
      isAcknowledged: false,
      ...permissions,
    };
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
    await userHelper.notifyInfringements(
      originalInfringements,
      results.infringements,
      results.firstName,
      results.lastName,
      results.email,
      results.role,
      results.startDate,
      results.jobTitle[0],
      results.weeklycommittedHours,
    );
  }

  async handlePostSaveOperations(req, user, originalInfringements, results) {
    await PermissionService.notifyInfringements(originalInfringements, results);
    await logUserPermissionChangeByAccount(req, user);
    this.updateUserCache(user._id.toString());
  }

  async updatePermissions(userId, permissions, req) {
    // Validate permissions data
    if (!PermissionService.validatePermissionsData(permissions)) {
      throw new Error('Invalid permissions data');
    }

    // Check authorization - pass UserProfile model to checkUpdateAuthorization
    const authResult = await PermissionService.checkUpdateAuthorization(
      req.body.requestor,
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

    // Handle post-save operations
    await this.handlePostSaveOperations(req, user, originalInfringements, results);

    return {
      message: 'Permissions updated successfully',
      _id: user._id,
      permissions: user.permissions,
    };
  }
}

module.exports = PermissionService;
