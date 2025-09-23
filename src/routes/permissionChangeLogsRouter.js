const express = require('express');

const routes = function (permissionChangeLog, userPermissionChangeLog) {
  const controller = require('../controllers/permissionChangeLogsController')(permissionChangeLog, userPermissionChangeLog);

  const permissionChangeLogRouter = express.Router();

  permissionChangeLogRouter.route('/permissionChangeLogs/:userId')
  .get(controller.getPermissionChangeLogs);

  return permissionChangeLogRouter;
};

module.exports = routes;
