const moment = require("moment-timezone");
const PermissionChangeLog = require("../models/permissionChangeLog")

// Middleware function
const changedPermissionsLogger = async (req, res, next) => {
  await logPermissionChangeByAccount(req.body)
  next();
};

// Function saves logs to hgnData_dev.permissionChangeLogs collection
const logPermissionChangeByAccount = async (requestBody) => {
  const { updatedRole, userProfile, requestor } = requestBody
  const dateTime = moment().tz("America/Los_Angeles").format();
  
  try {
    // Extract relevant data from the request
    const { roleId, roleName, permissions } = updatedRole; // Adjust this as per your request body structure
    const { role, email } = userProfile;
    const { requestorId } = requestor;

    // Create a new PermissionChangeLog object
    const logEntry = new PermissionChangeLog({
      logDateTime: dateTime,
      roleId: roleId,
      roleName: roleName,
      permissions: permissions,
      requestorId: requestorId,
      requestorRole: role,
      requestorEmail: email,
    });

    // Save the log entry to the database
    await logEntry.save();

  } catch (error) {
    // Handle any errors that occur during logging
    console.error('Error logging permission change:', error);
    // You can choose to send an error response to the client or handle it differently
    res.status(500).json({ error: 'Failed to log permission change' });
  }
}

module.exports = changedPermissionsLogger;
