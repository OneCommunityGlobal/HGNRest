const Role = require('../models/role');
const UserProfile = require('../models/userProfile');
const serverCache = require('./nodeCache')();
const userService = require('../services/userService');
const Logger = require('../startup/logger');
const { PROTECTED_EMAIL_ACCOUNT } = require('./constants');

const hasRolePermission = async (role, action) => Role.findOne({ roleName: role })
  .exec()
  .then(({ permissions }) => permissions.includes(action))
  .catch(false);

const hasIndividualPermission = async (userId, action) => UserProfile.findById(userId)
  .select('permissions')
  .exec()
  .then(({ permissions }) => permissions.frontPermissions.includes(action))
  .catch(false);

const hasPermission = async (requestor, action) => await hasRolePermission(requestor.role, action) || hasIndividualPermission(requestor.requestorId, action);

/**
 * Check if requestor can update specific Jae related user. Return false if requestorId is not Jae related user and targetUserId is Jae related user. Otherwise, return true.
 * @param {*} requestorId 
 * @param {*} userId 
 * @returns 
 */
const canRequestorUpdateUser = async (requestorId, targetUserId) => {
  let protectedEmailAccountIds;
  // Persist the list of protected email accounts in the application cache since this list is constant
  if (!serverCache.hasCache('protectedEmailAccountIds')) {
    try {
      // get the user info for the protected email accounts
      const query = await userService.getUserIdAndEmailByEmails(PROTECTED_EMAIL_ACCOUNT);
      // Check if all protected email accounts were found
      if (query.length !== PROTECTED_EMAIL_ACCOUNT.length) {
        // find out which email accounts were not found
        const notFoundEmails = PROTECTED_EMAIL_ACCOUNT.filter(
          (email) => !query.map(({ email }) => email).includes(email),
        );
        Logger.logInfo(
          `The following protected email accounts were not found in the database: ${notFoundEmails.join(', ')}`,
        );
      }
      protectedEmailAccountIds = query.map(({ _id }) => _id);
      serverCache.setCache('protectedEmailAccountIds', protectedEmailAccountIds);
      // Redefine time to live to 1 hour for this specific key
      serverCache.setKeyTimeToLive('protectedEmailAccountIds', 60 * 60);
    } catch (error) {
      Logger.logException(error, 'Error getting protected email accounts');
    }
  } else {
    protectedEmailAccountIds = serverCache.getCache('protectedEmailAccountIds');
  }

  return !(
    protectedEmailAccountIds.includes(targetUserId) &&
    !protectedEmailAccountIds.includes(requestorId)
  );
};

module.exports = { hasPermission, canRequestorUpdateUser };
