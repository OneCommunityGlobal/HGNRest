const { hasPermission } = require('../utilities/permissions');
const { logPublishingError } = require('../utilities/socialMediaCredentials');

module.exports = async function requireSocialPublishingPermission(req, res, next) {
  // req.user is set from the verified JWT by startup/middleware, unlike submitted form fields.
  if (!req.user?.requestorId) return res.status(401).json({ error: 'Authentication required.' });
  try {
    if (!(await hasPermission(req.user, 'sendEmails'))) {
      return res.status(403).json({ error: 'You are not authorized to publish announcements.' });
    }
    return next();
  } catch (error) {
    logPublishingError('Social-media publishing permission check failed:', error);
    return res.status(500).json({ error: 'Failed to check publishing permissions.' });
  }
};
