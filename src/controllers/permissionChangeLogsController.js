const permissionChangeLogController = function (PermissionChangeLog) {
  const getPermissionChangeLogs = async function (req, res) {
    // Check if user is Owner here. Skipped for now.

    const changeLogs = await PermissionChangeLog.find({})
    console.log("🚀 ~ file: permissionChangeLogsController.js:8 ~ getPermissionChangeLogs ~ changeLogs:", changeLogs)
    res.status(200).send(changeLogs)
  }

  return {
    getPermissionChangeLogs
  }
}

module.exports = permissionChangeLogController