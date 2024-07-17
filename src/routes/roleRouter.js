const express = require('express');
const changedPermissionsLogger = require('../utilities/logPermissionChangeByAccount');

const routes = function (role) {
  const controller = require('../controllers/rolesController')(role);
  const RolesRouter = express.Router();

  RolesRouter.route('/roles')
  .post(controller.createNewRole)
  .get(controller.getAllRoles);

  RolesRouter.route('/roles/:roleId')
  .get(controller.getRoleById)
  .patch(changedPermissionsLogger, controller.updateRoleById)
  .delete(controller.deleteRoleById);
return RolesRouter;
};

module.exports = routes;
