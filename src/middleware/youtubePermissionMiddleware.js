const { hasPermission } = require('../utilities/permissions');

/**
 * Middleware to check if the user has permission to post YouTube content.
 * This middleware should be placed BEFORE file upload middleware to prevent
 * unauthorized users from writing large files to the server's temp disk.
 *
 * Returns 401 if requestor is missing
 * Returns 403 if user doesn't have 'postYoutubeContent' permission
 */
const requireYoutubePermission = async (req, res, next) => {
  try {
    const requestor = req.requestor || req.body?.requestor;

    if (!requestor) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to access YouTube features.',
      });
    }

    const hasPermissionToPost = await hasPermission(requestor, 'postYoutubeContent');

    if (!hasPermissionToPost) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to post content to YouTube. Please contact your administrator.',
      });
    }

    next();
  } catch (error) {
    // Log the error but return a generic 500 to avoid information leakage
    // eslint-disable-next-line no-console
    console.error('YouTube permission check error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying your permissions. Please try again.',
    });
  }
};

module.exports = { requireYoutubePermission };
