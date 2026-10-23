const jwtVerificationLogic = require('./jwtVerificationLogic');

/**
 * Some routes (for example the public job application form reads) are exempt from the global
 * token check in startup/middleware.js, so req.user / req.body.requestor are never set on them.
 * This helper verifies an optional Authorization header with the same logic the global check uses
 * and reports whether the caller is an authenticated user. It never sends a response.
 */
const isAuthenticatedRequest = (req) => {
  const authHeader = req && typeof req.header === 'function' ? req.header('Authorization') : null;
  if (!authHeader) return false;

  const sink = {
    status: () => sink,
    json: () => sink,
    send: () => sink,
  };

  try {
    const payload = jwtVerificationLogic(authHeader, sink);
    return Boolean(payload && payload !== sink && payload.userid && payload.role);
  } catch (error) {
    // Any failure while verifying means the caller is treated as anonymous.
    return false;
  }
};

module.exports = { isAuthenticatedRequest };
