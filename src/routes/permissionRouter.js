const express = require('express');

const routes = function (permisssion) {
  const controller = require('../controllers/permissionController')(permisssion);
  const PermissionRoutes = express.Router();


  PermissionRoutes.route('/permissions')
    .get(controller.getAllPermissions)
    .post(controller.createNewPermission);

  PermissionRoutes.route('/permissions/:permissionId')
    .delete(controller.deletePermission);

return PermissionRoutes;
};

module.exports = routes;
