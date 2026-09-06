const jwtVerificationLogic = require('../utilities/jwtVerificationLogic');

// Reuses the repo-wide JWT verification pattern so req.user reflects the authenticated caller,
// not client-supplied data. Scoped to routes that must not trust a client-provided identity.
const authenticateHelpRequest = (req, res, next) => {
  const payload = jwtVerificationLogic(req.header('Authorization'), res);
  if (res.headersSent) return;
  req.user = {
    requestorId: payload.userid,
    role: payload.role,
    permissions: payload.permissions,
  };
  next();
};

module.exports = authenticateHelpRequest;
