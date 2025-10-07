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

const logUserPermissionChangeByAccount = async (req) => {
  const { permissions, firstName, lastName, requestor } = req.body;
  const dateTime = moment().tz('America/Los_Angeles').format();

  try {
    let permissionsAdded = [];
    let permissionsRemoved = [];
    const { userId } = req.params;
    const Permissions = permissions.frontPermissions;
    const removedPermissions = permissions.removedDefaultPermissions; // removed default permissions
    const rolePermissions = permissions.defaultPermissions; // default permissions for user provided by their role
    const changedPermissions = [...Permissions, ...removedPermissions];
    const requestorEmailId = await UserProfile.findById(requestor.requestorId)
      .select('email')
      .exec();
    const document = await findLatestRelatedLog(userId);

    if (document) {
      const docPermissions = Array.isArray(document.permissions) ? document.permissions : [];
      const docRemovedRolePermissions = Array.isArray(document.removedRolePermissions)
        ? document.removedRolePermissions
        : [];
      const docSavedChanges = [...docPermissions, docRemovedRolePermissions];
      // no new changes in permissions list from last update
      if (JSON.stringify(docSavedChanges.sort()) === JSON.stringify(changedPermissions.sort())) {
        return;
      }
      const prevRemovedPermissions = document.permissionsRemoved;
      const prevAddedPermissions = document.permissionsAdded;
      permissionsRemoved = [
        ...removedPermissions.filter((item) => !prevRemovedPermissions.includes(item)), // saves new removed role defaults
        ...prevAddedPermissions.filter(
          (item) => !Permissions.includes(item) && !rolePermissions.includes(item),
        ), // removed user added permissions
      ];
      permissionsAdded = [
        ...Permissions.filter((item) => !prevAddedPermissions.includes(item)), // saves new added permissions
        ...prevRemovedPermissions.filter(
          (item) => removedPermissions.includes(item) && rolePermissions.includes(item),
        ), // removed role permissions added back
      ];
    } else {
      permissionsAdded = Permissions;
      permissionsRemoved = removedPermissions; // adds removed default permissions to permissionsRemoved for inital log
    }

    // no permission added nor removed
    if (permissionsRemoved.length === 0 && permissionsAdded.length === 0) {
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
    });

    await logEntry.save();
    console.log('Permission change logged successfully');
  } catch (error) {
    console.error('Error logging permission change:', error);
  }
};

module.exports = logUserPermissionChangeByAccount;
