const moment = require("moment-timezone");
const PermissionChangeLog = require("../models/permissionChangeLog")

// Middleware function
const changedPermissionsLogger = async (req, res, next) => {
  await logPermissionChangeByAccount(req.body)
  next();
};

// Helper function finds the latest log related to the permission
const findLatestRelatedLog = (roleId) => {

  return new Promise((resolve, reject) => {
    PermissionChangeLog.findOne({ roleId: roleId })
      .sort({ logDateTime: -1 })
      .exec((err, document) => {
        if (err) {
          console.error(err);
          reject(err);
          return;
        }
        console.log("🚀 ~ file: logPermissionChangeByAccount.js:20 ~ .exec ~ document:", document);
        resolve(document);
      });
  })
}

// Function saves logs to hgnData_dev.permissionChangeLogs collection
const logPermissionChangeByAccount = async (requestBody) => {
  const { roleId, roleName, permissions, requestor, role, email } = requestBody
  const dateTime = moment().tz("America/Los_Angeles").format();
  
  try {
    let permissionsAdded = []
    let permissionsRemoved = []

    // Find the latest log related to permission
    const document = await findLatestRelatedLog(roleId)
    console.log("🚀 ~ file: logPermissionChangeByAccount.js:36 ~ logPermissionChangeByAccount ~ document:", document)

    if (document) {
      // console.log(document);
      console.log("🚀 ~ file: logPermissionChangeByAccount.js:29 ~ .exec ~ document:", document)
      permissionsRemoved = document.permissions.filter(item => !(permissions.includes(item)))
      console.log("🚀 ~ file: logPermissionChangeByAccount.js:31 ~ .exec ~ permissionsRemoved:", permissionsRemoved)
      permissionsAdded = permissions.filter(item => !(document.permissions.includes(item)))
      console.log("🚀 ~ file: logPermissionChangeByAccount.js:33 ~ .exec ~ permissionsAdded:", permissionsAdded)
    } else {
      // else this is the first permissions change log for this particular role
      permissionsAdded = permissions
    }

    
    const logEntry = new PermissionChangeLog({
      logDateTime: dateTime,
      roleId: roleId,
      roleName: roleName,
      permissions: permissions,
      permissionsAdded: permissionsAdded,
      permissionsRemoved: permissionsRemoved,
      requestorId: requestor.requestorId,
      requestorRole: role,
      requestorEmail: email,
    })
      
    console.log("🚀 ~ file: logPermissionChangeByAccount.js:46 ~ .exec ~ logEntry:", logEntry)

    await logEntry.save()

  }  catch (error) {
    console.error('Error logging permission change:', error);
    res.status(500).json({ error: 'Failed to log permission change' });
  }
}

module.exports = changedPermissionsLogger;
