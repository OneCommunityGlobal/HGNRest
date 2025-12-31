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

const logUserPermissionChangeByAccount = async (req, user) => {
  const { permissions, requestor, reason } = req.body;
  const dateTime = moment().tz('America/Los_Angeles').format();

  try {
    let permissionsAdded = [];
    let permissionsRemoved = [];
    let roleChanged = false;
    const { userId } = req.params;
    const Permissions = permissions.frontPermissions;
    const removedPermissions = permissions.removedDefaultPermissions; // removed default permissions
    const rolePermissions = permissions.defaultPermissions; // default permissions for user provided by their role
    const changedPermissions = [...Permissions, ...removedPermissions];

    // Fetch requestor email
    const requestorEmailId = await UserProfile.findById(requestor.requestorId)
      .select('email')
      .exec();

    // Use the user object passed from controller (already fetched)
    const { firstName, lastName } = user;

    const document = await findLatestRelatedLog(userId);

    if (document) {
      const docPermissions = Array.isArray(document.permissions) ? document.permissions : [];
      const docRemovedRolePermissions = Array.isArray(document.removedRolePermissions)
        ? document.removedRolePermissions
        : [];
      roleChanged = reason.includes('Role Changed');
      const docSavedChanges = [...docPermissions, docRemovedRolePermissions];
      // no new changes in permissions list from last update and no role change
      if (
        JSON.stringify(docSavedChanges.sort()) === JSON.stringify(changedPermissions.sort()) &&
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
      requestorEmail: requestorEmailId.email,
      reason,
    });

    await logEntry.save();
  } catch (error) {
    console.error('Error logging permission change:', error);
  }
};

module.exports = logUserPermissionChangeByAccount;
