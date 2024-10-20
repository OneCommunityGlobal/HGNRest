const UserProfile = require('../models/userProfile');

const permissionChangeLogController = function (PermissionChangeLog) {
  const getPermissionChangeLogs = async function (req, res) {
    try {
      const userProfile = await UserProfile.findOne({ _id: req.params.userId }).exec();

      if (userProfile) {
        if (userProfile.role !== 'Owner') {
          return res.status(204).send([]);
        }
        const changeLogs = await PermissionChangeLog.find({});
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
