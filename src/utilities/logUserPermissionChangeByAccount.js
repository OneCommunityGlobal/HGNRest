/* eslint-disable no-use-before-define */
const moment = require('moment-timezone');
const UserPermissionChangeLog = require('../models/userPermissionChangeLog');
const UserProfile = require('../models/userProfile');

const findLatestRelatedLog = (userId) =>
  new Promise((resolve, reject) => {
    UserPermissionChangeLog.findOne({ userId })
      .sort({ logDateTime: -1 })
      .exec((err, document) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(document);
      });
  });

//

const checkPermissionArray = (permArray) => (Array.isArray(permArray) ? permArray : []);

const logUserPermissionChangeByAccount = async (req, user) => {
  const { permissions, requestor, reason } = req.body;
  const dateTime = moment().tz('America/Los_Angeles').format();

  try {
    if (!permissions || !requestor?.requestorId) {
      return;
    }

    // Fetch requestor email (may be null if requestor deleted)
    const requestorDoc = await UserProfile.findById(requestor.requestorId)
      .select('email')
      .lean()
      .exec();
    const requestorEmail = requestorDoc?.email ?? 'unknown';

    // const { firstName, lastName } = user;
    let permissionsAdded = [];
    let permissionsRemoved = [];
    const roleChanged = reason.includes('Role Changed');
    const { userId } = req.params;
    const Permissions = checkPermissionArray(permissions.frontPermissions);
    const removedPermissions = checkPermissionArray(permissions.removedDefaultPermissions); // removed default permissions
    const rolePermissions = checkPermissionArray(permissions.defaultPermissions); // default permissions for user provided by their role
    const changedPermissions = [...Permissions, ...removedPermissions];

    // Use the user object passed from controller (already fetched)
    const { firstName, lastName } = user;

    const document = await findLatestRelatedLog(userId);

    if (document) {
      const docPermissions = checkPermissionArray(document.permissions);
      const docRemovedRolePermissions = checkPermissionArray(document.removedRolePermissions);
      const docSavedChanges = [...docPermissions, ...docRemovedRolePermissions];
      const sortedSaved = [...docSavedChanges].sort((a, b) => a.localeCompare(b));
      const sortedChanged = [...changedPermissions].sort((a, b) => a.localeCompare(b));
      // no new changes in permissions list from last update and no role change
      if (
        sortedSaved.length === sortedChanged.length &&
        sortedSaved.every((value, index) => value === sortedChanged[index]) &&
        !roleChanged
      ) {
        return;
      }
      permissionsRemoved = [
        ...removedPermissions.filter((item) => !docRemovedRolePermissions.includes(item)), // saves new removed role defaults
        ...docPermissions.filter(
          (item) => !Permissions.includes(item) && !rolePermissions.includes(item),
        ), // removed user added permissions
      ];
      permissionsAdded = [
        ...Permissions.filter((item) => !docPermissions.includes(item)), // saves new added permissions
        ...docRemovedRolePermissions.filter(
          (item) => !removedPermissions.includes(item) && rolePermissions.includes(item),
        ), // removed role permissions added back
      ];
    } else {
      permissionsAdded = Permissions;
      permissionsRemoved = removedPermissions; // adds removed default permissions to permissionsRemoved for inital log
    }

    // no permission added nor removed nor role change
    if (permissionsRemoved.length === 0 && permissionsAdded.length === 0 && !roleChanged) {
      return;
    }

    const logEntry = new UserPermissionChangeLog({
      logDateTime: dateTime,
      userId,
      individualName: `INDIVIDUAL: ${firstName} ${lastName}`,
      permissions: Permissions,
      removedRolePermissions: removedPermissions,
      permissionsAdded,
      permissionsRemoved,
      requestorRole: requestor.role,
      reason,
      requestorEmail,
    });

    await logEntry.save();
  } catch (error) {
    console.error('Error logging permission change:', error);
  }
};

module.exports = logUserPermissionChangeByAccount;
