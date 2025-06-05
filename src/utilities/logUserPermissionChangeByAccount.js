const moment = require('moment-timezone');
const UserPermissionChangeLog = require('../models/userPermissionChangeLog');
const UserProfile = require('../models/userProfile');

const logUserPermissionChangeByAccount = async (req) => {
  const { permissions, firstName, lastName, requestor } = req.body;
  const dateTime = moment().tz('America/Los_Angeles').format();

  try {
    let permissionsAdded = [];
    let permissionsRemoved = [];
    const { userId } = req.params;
    const Permissions = permissions.frontPermissions;
    const removedPermissions = permissions.removedDefaultPermissions; // removed default permissions
    const defaultPermissions = permissions.defaultPermissions; // default permissions for user provided by their role
    const changedPermissions = [...Permissions, ...removedPermissions];
    const requestorEmailId = await UserProfile.findById(requestor.requestorId)
      .select('email')
      .exec();
    const document = await findLatestRelatedLog(userId);

    if (document) {
      const docPermissions = Array.isArray(document.permissions) ? document.permissions : [];
      // no new changes in permissions list from last update
      if (JSON.stringify(docPermissions.sort()) === JSON.stringify(changedPermissions.sort())) {
        return;
      }
      permissionsRemoved = [
        ...removedPermissions.filter((item) => !docPermissions.includes(item)), //saves new removed defaults
        ...docPermissions.filter(
          // saves changes of only removed non-default role permissions for user
          (item) => !defaultPermissions.includes(item) && !Permissions.includes(item),
        ),
      ];
      permissionsAdded = [
        ...Permissions.filter((item) => !docPermissions.includes(item)), // saves new added permissions
        ...docPermissions.filter(
          // saves changes of only removed default permissions being added back
          (item) => defaultPermissions.includes(item) && !removedPermissions.includes(item),
        ),
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
      permissions: changedPermissions, // changed from Permissions to changedPermissions, to track changes for default and non-default permissions
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

module.exports = logUserPermissionChangeByAccount;
