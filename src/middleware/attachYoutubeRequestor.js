const jwtVerificationLogic = require('../utilities/jwtVerificationLogic');

/**
 * YouTube routes are mounted before the global auth middleware, so req.requestor is never set
 * for them. This verifies the JWT in the Authorization header and attaches the requestor.
 */
const attachYoutubeRequestor = (req, res, next) => {
  const payload = jwtVerificationLogic(req.header('Authorization'), res);
  if (res.headersSent) return undefined;

  req.requestor = {
    requestorId: payload.userid,
    role: payload.role,
    permissions: payload.permissions,
  };
  return next();
};

module.exports = { attachYoutubeRequestor };
