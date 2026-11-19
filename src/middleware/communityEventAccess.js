const jwtVerificationLogic = require('../utilities/jwtVerificationLogic');

const requireCommunityEventAccess = (req, res, next) => {
  const payload = jwtVerificationLogic(req.headers.authorization, res);
  if (res.headersSent) return;

  // Community portal login currently shares the secondary-login token contract.
  if (payload.access?.canAccessBMPortal !== true) {
    return res.status(403).json({ error: 'Secondary portal login is required' });
  }

  req.communityPortalUserId = payload.userid;
  next();
};

const requireOwnEventRegistration = (req, res, next) => {
  const userId = req.params.userId ?? req.body.userId;
  if (!req.communityPortalUserId || userId !== req.communityPortalUserId) {
    return res.status(403).json({ error: 'You can only change your own event registration' });
  }
  next();
};

module.exports = { requireCommunityEventAccess, requireOwnEventRegistration };
