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
 * Check if requestor can update a specific user. 
 * @param {*} requestorId 
 * @param {*} userId 
 * @returns 
 */
const canRequestorUpdateUser = (requestorId, targetUserId) => {
  let protectedEmailAccountIds;
  // Persist the list of protected email accounts in the application cache since this list is constant
  if (!serverCache.hasCache('protectedEmailAccountIds')) {
    try {
      // get the user info for the protected email accounts
      const query = userService.getUserProfilesIdAndEmail(PROTECTED_EMAIL_ACCOUNT);
      if (query.length !== PROTECTED_EMAIL_ACCOUNT.length) {
        // find out which email accounts were not found
        const notFoundEmails = PROTECTED_EMAIL_ACCOUNT.filter((email) => !query.map(({ email }) => email).includes(email));
        Logger.logException(new Error(`The following protected email accounts were not found in the database: ${notFoundEmails.join(', ')}`));
      }
      protectedEmailAccountIds = query.map(({ _id }) => _id);
      serverCache.setCache('protectedEmailAccountIds', protectedEmailAccountIds);
    } catch (error) {
      Logger.logException(error, 'Error getting protected email accounts');
    }
  } else {
    protectedEmailAccountIds = serverCache.getCache('protectedEmailAccountIds');
  }
  
  return !(protectedEmailAccountIds.includes(targetUserId) && !protectedEmailAccountIds.includes(requestorId));
};

module.exports = { hasPermission, canRequestorUpdateUser };
