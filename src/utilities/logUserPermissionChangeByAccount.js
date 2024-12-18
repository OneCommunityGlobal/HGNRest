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
    const requestorEmailId = await UserProfile.findById(requestor.requestorId).select('email').exec();
    const document = await findLatestRelatedLog(userId);

    if (document) {
      const docPermissions = Array.isArray(document.permissions) ? document.permissions : [];
      if(JSON.stringify(docPermissions) === JSON.stringify(Permissions)) {
        return;
      }
      permissionsRemoved = docPermissions.filter((item) => !Permissions.includes(item));
      permissionsAdded = Permissions.filter((item) => !docPermissions.includes(item));
    } else {
      permissionsAdded = Permissions;
    }

    const logEntry = new UserPermissionChangeLog({
      logDateTime: dateTime,
      userId,
      individualName: `${firstName} ${lastName}`,
      permissions: Permissions,
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

const findLatestRelatedLog = (userId) => new Promise((resolve, reject) => {
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
