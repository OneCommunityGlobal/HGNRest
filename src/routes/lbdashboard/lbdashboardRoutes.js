const express = require('express');

const routes = function () {
  const registerRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/lbdashboardController');
  const adminUserController = require('../../controllers/lbdashboard/lbAdminUserController');
  const { requireLBAdmin } = require('../../middleware/lbdashboard/requireLBAdmin');

  registerRouter.route('/register').post(controller.registerUser);

  // Admin user management (every /admin route requires an authenticated Administrator/Owner)
  registerRouter.use('/admin', requireLBAdmin);
  registerRouter.route('/admin/users').get(adminUserController.listUsers);
  registerRouter
    .route('/admin/users/:id')
    .get(adminUserController.getUserById)
    .patch(adminUserController.updateUser)
    .delete(adminUserController.deleteUser);

  return registerRouter;
};

module.exports = routes;
