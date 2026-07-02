const PermissionService = require('../services/permissionService');

const permissionController = function (UserProfile) {
  const permissionService = new PermissionService(UserProfile);

  const managePermissions = async function (req, res) {
    const { userId } = req.params;
    const { permissions } = req.body;

    try {
      const result = await permissionService.updatePermissions(userId, permissions, req);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error updating permissions:', error);

      const statusCode = error.statusCode || 500;
      const message = error.message || 'Failed to update permissions';

      return res.status(statusCode).send({
        error: message,
        details: error.message,
      });
    }
  };

  return {
    managePermissions,
  };
};

module.exports = permissionController;
