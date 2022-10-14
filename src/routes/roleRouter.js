const express = require('express');

const routes = function (role) {
  const controller = require('../controllers/rolesController')(role);
  const RolesRouter = express.Router();

  RolesRouter.route('/roles')
  .post(controller.createNewRole)
  .get(controller.getAllRoles);

  RolesRouter.route('/roles/:roleId')
  .get(controller.getRoleById)
  .patch(controller.updateRoleById);

  return RolesRouter;
};

module.exports = routes;
