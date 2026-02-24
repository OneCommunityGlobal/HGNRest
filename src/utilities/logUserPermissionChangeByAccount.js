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

const logUserPermissionChangeByAccount = async (req, user) => {
  const { permissions, requestor } = req.body;
  const dateTime = moment().tz('America/Los_Angeles').format();

  try {
    if (!permissions || !requestor?.requestorId) {
      return;
    }

    const Permissions = Array.isArray(permissions.frontPermissions)
      ? permissions.frontPermissions
      : [];
    const { userId } = req.params;

    // Fetch requestor email (may be null if requestor deleted)
    const requestorDoc = await UserProfile.findById(requestor.requestorId)
      .select('email')
      .lean()
      .exec();
    const requestorEmail = requestorDoc?.email ?? 'unknown';

    const { firstName, lastName } = user;
    let permissionsAdded = [];
    let permissionsRemoved = [];

    const document = await findLatestRelatedLog(userId);

    if (document) {
      const docPermissions = Array.isArray(document.permissions) ? document.permissions : [];
      const sortedDoc = [...docPermissions].sort();
      const sortedCurrent = [...Permissions].sort();
      if (JSON.stringify(sortedDoc) === JSON.stringify(sortedCurrent)) {
        return;
      }
      permissionsRemoved = docPermissions.filter((item) => !Permissions.includes(item));
      permissionsAdded = Permissions.filter((item) => !docPermissions.includes(item));
    } else {
      permissionsAdded = Permissions;
    }

    if (permissionsRemoved.length === 0 && permissionsAdded.length === 0) {
      return;
    }

    const logEntry = new UserPermissionChangeLog({
      logDateTime: dateTime,
      userId,
      individualName: `INDIVIDUAL: ${firstName} ${lastName}`,
      permissions: Permissions,
      permissionsAdded,
      permissionsRemoved,
      requestorRole: requestor.role,
      requestorEmail,
    });

    await logEntry.save();
  } catch (error) {
    console.error('Error logging permission change:', error);
  }
};

module.exports = logUserPermissionChangeByAccount;
