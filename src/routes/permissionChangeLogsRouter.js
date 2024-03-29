const express = require('express');

const routes = function (permissionChangeLog) {
  const controller = require('../controllers/permissionChangeLogsController')(permissionChangeLog);

  const permissionChangeLogRouter = express.Router();

  permissionChangeLogRouter.route('/permissionChangeLogs/:userId')
  .get(controller.getPermissionChangeLogs);

  return permissionChangeLogRouter;
};

module.exports = routes;
