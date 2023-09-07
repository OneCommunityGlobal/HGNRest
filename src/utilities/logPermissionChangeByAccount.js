const moment = require("moment-timezone");
const PermissionChangeLog = require("../models/permissionChangeLog")

// Middleware function
const changedPermissionsLogger = async (req, res, next) => {
  await logPermissionChangeByAccount(req.body)
  next();
};

// Function saves logs to hgnData_dev.permissionChangeLogs collection
const logPermissionChangeByAccount = async (requestBody) => {
  const { roleId, roleName, permissions, requestor, role, email } = requestBody
  const dateTime = moment().tz("America/Los_Angeles").format();
  
  try {
    const logEntry = new PermissionChangeLog({
      logDateTime: dateTime,
      roleId: roleId,
      roleName: roleName,
      permissions: permissions,
      requestorId: requestor.requestorId,
      requestorRole: role,
      requestorEmail: email,
    });

    await logEntry.save();

  } catch (error) {
    console.error('Error logging permission change:', error);
    res.status(500).json({ error: 'Failed to log permission change' });
  }
}

module.exports = changedPermissionsLogger;
