const UserProfile = require('../models/userProfile');

const permissionChangeLogController = function (PermissionChangeLog, userPermissionChangeLog) {
  const getPermissionChangeLogs = async function (req, res) {
    try {
      const userProfile = await UserProfile.findOne({ _id: req.params.userId }).exec();

      if (userProfile) {
        if (userProfile.role !== 'Owner') {
          res.status(204).send([]);
        } else {
          const userChangeLogs = await userPermissionChangeLog.find();
          const rolePermissionChangeLogs = await PermissionChangeLog.find();

          const formattedUserChangeLogs = userChangeLogs.map((log) => ({
            ...log.toObject(),
            name: log.individualName,
          }));

          const formattedRolePermissionChangeLogs = rolePermissionChangeLogs.map((log) => ({
            ...log.toObject(),
            name: log.roleName,
          }));

          const mergedLogs = [
            ...formattedUserChangeLogs,
            ...formattedRolePermissionChangeLogs,
          ].sort((a, b) => new Date(b.logDateTime) - new Date(a.logDateTime));

          res.status(200).json(mergedLogs);
        }
      } else {
        res.status(403).send(`User (${req.params.userId}) not found.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return {
    getPermissionChangeLogs,
  };
};

module.exports = permissionChangeLogController;
