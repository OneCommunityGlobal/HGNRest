const express = require('express');

const routes = function (userProfile) {
  const controller = require('../controllers/permissionController')(userProfile);

  const permissionRouter = express.Router();

  permissionRouter.route('/user/:userId').patch(controller.managePermissions);

  return permissionRouter;
};

module.exports = routes;
