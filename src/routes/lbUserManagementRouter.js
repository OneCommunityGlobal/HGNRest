const express = require('express');
const lbUserManagementController = require('../controllers/lbUserManagementController');
const { requireLBAdmin } = require('../middleware/lbdashboard/requireLBAdmin');

const router = express.Router();

router.post('/register', lbUserManagementController.registerUser);

router.use('/admin', requireLBAdmin);
router.get('/admin/users', lbUserManagementController.listUsers);
router
  .route('/admin/users/:id')
  .get(lbUserManagementController.getUserById)
  .patch(lbUserManagementController.updateUser)
  .delete(lbUserManagementController.deleteUser);

module.exports = router;
