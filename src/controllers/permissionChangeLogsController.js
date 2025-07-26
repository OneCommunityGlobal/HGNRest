const UserProfile = require('../models/userProfile');

const permissionChangeLogController = function (PermissionChangeLog, userPermissionChangeLog) {
  const getPermissionChangeLogs = async function (req, res) {
    try {
      const userProfile = await UserProfile.findOne({ _id: req.params.userId }).exec();

      if (userProfile) {
        if (userProfile.role !== 'Owner') {
          return res.status(204).send([]);
        }
        // Add usage of userPermissionChangeLog so the log table displays logs of changes to permissions of both
        // user and roles, and the .sort ensures the latest log is first on page 1, and the oldest is last on the
        // last page
        const roleChangeLogs = await PermissionChangeLog.find({});
        const userChangeLogs = await userPermissionChangeLog.find({});
        const changeLogs = [...roleChangeLogs, ...userChangeLogs];
        changeLogs.sort((a, b) => new Date(b.logDateTime) - new Date(a.logDateTime));
        return res.status(200).send(changeLogs);
      }
      return res.status(403).send(`User (${req.params.userId}) not found.`);
    } catch (err) {
      return res.status(400).send(err.message);
    }
  };

  return {
    getPermissionChangeLogs,
  };
};

module.exports = permissionChangeLogController;
