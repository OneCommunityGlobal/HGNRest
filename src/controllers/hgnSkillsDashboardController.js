const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');

const hgnSkillsDashboardController = function (UserProfile) {
  const checkDashboardAccess = async function (req, res) {
    try {
      // Get userId from URL parameters
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      // First, fetch the user to get their role
      const user = await UserProfile.findById(userId).select('role permissions');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Create a requestor object for the target user with their role
      const targetRequestor = {
        requestorId: userId,
        role: user.role,
        permissions: user.permissions || {}
      };

      // Always check for accessHgnSkillsDashboard permission
      const hasAccess = await hasPermission(targetRequestor, 'accessHgnSkillsDashboard');
      
      // Return a simple boolean response like permissions.js does
      res.json(hasAccess);
    } catch (error) {
      logger.logException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to check dashboard access permission'
      });
    }
  };

  return {
    checkDashboardAccess
  };
};

module.exports = hgnSkillsDashboardController; 