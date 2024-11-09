const moment = require('moment-timezone');
const UserProfile = require('../models/userProfile');
const UserPermissionChangeLog = require('../models/userPermissionChangeLog');
const PermissionChangeLog = require('../models/permissionChangeLog');

const logUserPermissionController = function () {
  const logPermissionChanges = async function (req, res) {
    try {
      const {
        actualUserProfile,
        authUser,
        userId,
        existingPermissions,
        addedPermissions,
        removedPermissions,
      } = req.body;

      const dateTime = moment().tz('America/Los_Angeles').format();

      const logEntry = new UserPermissionChangeLog({
        logDateTime: dateTime,
        userId,
        individualName: `${actualUserProfile.firstName} ${actualUserProfile.lastName}`,
        permissions: existingPermissions,
        permissionsAdded: addedPermissions,
        permissionsRemoved: removedPermissions,
        requestorRole: authUser.role,
        requestorEmail: authUser.email,
      });

      await logEntry.save();
      res.status(200).json({ message: 'Permission changes logged successfully' });
    } catch (error) {
      console.error('Error logging permission change:', error);
      res.status(500).json({ error: 'Failed to log permission change' });
    }
  };

  const getPermissionChangeLogs = async function (req, res) {
    try {
      const userProfile = await UserProfile.findOne({ _id: req.params.userId }).exec();

      if (userProfile) {
        if (userProfile.role !== 'Owner') {
          res.status(204).send([]);
        } else {
          // Fetch logs from both collections
          const userChangeLogs = await UserPermissionChangeLog.find();
          const rolePermissionChangeLogs = await PermissionChangeLog.find();

          const formattedUserChangeLogs = userChangeLogs.map(log => ({
            ...log.toObject(),
            name: log.individualName,
          }));

          const formattedRolePermissionChangeLogs = rolePermissionChangeLogs.map(log => ({
            ...log.toObject(),
            name: log.roleName,
          }));

          const mergedLogs = [...formattedUserChangeLogs, ...formattedRolePermissionChangeLogs].sort(
            (a, b) => new Date(b.logDateTime) - new Date(a.logDateTime)
          );

          res.status(200).json(mergedLogs);
        }
      } else {
        res.status(403).send(`User (${req.params.userId}) not found.`);
      }
    } catch (error) {
      console.error('Error fetching permission change logs:', error);
      res.status(500).json({ error: 'Failed to fetch permission change logs' });
    }
  };

  return {
    logPermissionChanges,
    getPermissionChangeLogs,
  };
};

module.exports = logUserPermissionController;
