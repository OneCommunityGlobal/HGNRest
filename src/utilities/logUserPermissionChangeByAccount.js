const moment = require('moment-timezone');
const UserPermissionChangeLog = require('../models/userPermissionChangeLog');
const UserProfile = require('../models/userProfile');

// Middleware function to log permission changes
const logUserPermissionChangeByAccount = async (req, res, next) => {
  const {
    permissions, firstName, lastName, requestor
  } = req.body;

  const dateTime = moment().tz('America/Los_Angeles').format();

  try {
    let permissionsAdded = [];
    let permissionsRemoved = [];
    const { userId } = req.params;

    // Ensure permissions is always an array
    const Permissions = permissions.frontPermissions;
    const requestorEmailId = await UserProfile.findById(req.body.requestor.requestorId)
        .select('email')
        .exec();
    // Find the latest log related to the user's permissions
    const document = await findLatestRelatedLog(userId);

    if (document) {
      // Ensure document.permissions is an array before filtering
      const docPermissions = Array.isArray(document.permissions) ? document.permissions : [];

      // Calculate removed permissions
      permissionsRemoved = docPermissions.filter((item) => !Permissions.includes(item));
      // Calculate added permissions
      permissionsAdded = Permissions.filter((item) => !docPermissions.includes(item));
    } else {
      // If no previous log exists, assume all permissions are new (first time log)
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

    // Save the new log entry
    await logEntry.save();

    // Proceed to the next middleware or route
    next();
  } catch (error) {
    console.error('Error logging permission change:', error);
    res.status(500).json({ error: 'Failed to log permission change' });
  }
};

// Helper function to find the latest permission log for a user
const findLatestRelatedLog = (userId) => new Promise((resolve, reject) => {
  UserPermissionChangeLog.findOne({ userId })
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

module.exports = logUserPermissionChangeByAccount;
