const UserProfile = require('../models/userProfile');

const permissionChangeLogController = function (PermissionChangeLog) {

  const getPermissionChangeLogs = async function (req, res) {

    try {
      const userProfile = await UserProfile.findOne({ _id: req.params.userId }).exec()

      if (userProfile) {
        if (userProfile.role !== 'Owner') {
          res.status(204).send([])
        } else {
          const changeLogs = await PermissionChangeLog.find({})
          res.status(200).send(changeLogs)
        }
      } else {
        res.status(403).send(`User (${req.params.userId}) not found.`)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return {
    getPermissionChangeLogs
  }
}

module.exports = permissionChangeLogController