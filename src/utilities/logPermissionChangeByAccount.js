const moment = require('moment-timezone');
const PermissionChangeLog = require('../models/permissionChangeLog');

// Middleware function
const changedPermissionsLogger = async (req, res, next) => {
  await logPermissionChangeByAccount(req.body);
  next();
};

// Helper function finds the latest log related to the permission
const findLatestRelatedLog = (roleId) => new Promise((resolve, reject) => {
    PermissionChangeLog.findOne({ roleId })
      .sort({ logDateTime: -1 })
      .exec((err, document) => {
        if (err) {
          console.error(err);
          reject(err);
          return;
        }
        resolve(document);
      });
  });

// Function saves logs to hgnData_dev.permissionChangeLogs collection
const logPermissionChangeByAccount = async (requestBody) => {
  const {
 roleId, roleName, permissions, requestor, role, email,
} = requestBody;
  const dateTime = moment().tz('America/Los_Angeles').format();

  try {
    let permissionsAdded = [];
    let permissionsRemoved = [];

    // Find the latest log related to permission
    const document = await findLatestRelatedLog(roleId);

    if (document) {
      permissionsRemoved = document.permissions.filter((item) => !(permissions.includes(item)));
      permissionsAdded = permissions.filter((item) => !(document.permissions.includes(item)));
    } else {
      // else this is the first permissions change log for this particular role
      permissionsAdded = permissions;
    }

    const logEntry = new PermissionChangeLog({
      logDateTime: dateTime,
      roleId,
      roleName,
      permissions,
      permissionsAdded,
      permissionsRemoved,
      requestorId: requestor.requestorId,
      requestorRole: role,
      requestorEmail: email,
    });

    await logEntry.save();
  } catch (error) {
    console.error('Error logging permission change:', error);
    res.status(500).json({ error: 'Failed to log permission change' });
  }
};

module.exports = changedPermissionsLogger;
