const Role = require('../models/role');
const UserProfile = require('../models/userProfile');
const serverCache = require('./nodeCache')();
const userService = require('../services/userService');
const Logger = require('../startup/logger');
const { PROTECTED_EMAIL_ACCOUNT, ALLOWED_EMAIL_ACCOUNT } = require('./constants');

const hasRolePermission = async (role, action) =>
  Role.findOne({ roleName: role })
    .exec()
    .then(({ permissions }) => permissions.includes(action))
    .catch(false);

const hasIndividualPermission = async (userId, action) =>
  UserProfile.findById(userId)
    .select('permissions')
    .exec()
    .then(({ permissions }) => permissions.frontPermissions.includes(action))
    .catch(false);

const hasPermission = async (requestor, action) =>
  (await hasRolePermission(requestor.role, action)) ||
  hasIndividualPermission(requestor.requestorId, action);

function getDistinct(arr1, arr2) {
  // Merge arrays and reduce to distinct elements
  const distinctArray = arr1.concat(arr2).reduce((acc, curr) => {
    if (acc.indexOf(curr) === -1) {
      acc.push(curr);
    }
    return acc;
  }, []);

  return distinctArray;
}
/**
 * Check if requestor can update specific Jae related user. Return false if requestor not allowed to update. Otherwise, return true.
 * @param {*} requestorId
 * @param {*} userId
 * @returns
 */
const canRequestorUpdateUser = async (requestorId, targetUserId) => {
  let protectedEmailAccountIds;
  let allowedEmailAccountIds;
  const emailToQuery = getDistinct(PROTECTED_EMAIL_ACCOUNT, ALLOWED_EMAIL_ACCOUNT);
  // Persist the list of protected email accounts in the application cache
  if (!serverCache.hasCache('protectedEmailAccountIds')) {
    try {
      // get the user info by email accounts
      const query = await userService.getUserIdAndEmailByEmails(emailToQuery);
      // Check if all protected email accounts were found
      if (query.length !== emailToQuery.length) {
        // find out which email accounts were not found
        const notFoundEmails = emailToQuery.filter(
          (entity) => !query.map(({ email }) => email).includes(entity),
        );
        Logger.logInfo(
          `The following protected email accounts were not found in the ${process.env.NODE_ENV} database: ${notFoundEmails.join(', ')}.`,
        );
      }
      // Find out a list of protected email account ids and allowed email id
      allowedEmailAccountIds = query
        .filter(({ email }) => ALLOWED_EMAIL_ACCOUNT.includes(email))
        .map(({ _id }) => _id);
      protectedEmailAccountIds = query
        .filter(({ email }) => PROTECTED_EMAIL_ACCOUNT.includes(email))
        .map(({ _id }) => _id);

      serverCache.setCache('protectedEmailAccountIds', protectedEmailAccountIds);
      serverCache.setCache('allowedEmailAccountIds', allowedEmailAccountIds);
      // Redefine time to live to 1 hour for this specific key
      serverCache.setKeyTimeToLive('protectedEmailAccountIds', 60 * 60);
      serverCache.setKeyTimeToLive('allowedEmailAccountIds', 60 * 60);
    } catch (error) {
      Logger.logException(error, 'Error getting protected email accounts');
    }
  } else {
    protectedEmailAccountIds = serverCache.getCache('protectedEmailAccountIds');
    allowedEmailAccountIds = serverCache.getCache('allowedEmailAccountIds');
  }
  // Check requestor edit permission and check target user is protected or not.
  return !(
    protectedEmailAccountIds.includes(targetUserId) && !allowedEmailAccountIds.includes(requestorId)
  );
};

module.exports = { hasPermission, canRequestorUpdateUser };
