const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../../config');

const ADMIN_ROLES = ['Administrator', 'Owner', 'Admin', 'admin'];
const BEARER_PREFIX = 'Bearer ';

const getToken = (authHeader) => {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const trimmed = authHeader.trim();
  if (!trimmed) return null;
  return trimmed.startsWith(BEARER_PREFIX) ? trimmed.slice(BEARER_PREFIX.length).trim() : trimmed;
};

const verifyPayload = (token) => {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const userId = payload.userid || payload.userId || payload.id;
    if (!userId || !payload.role) return null;

    if (payload.expiryTimestamp !== undefined) {
      const isExpired =
        !moment(payload.expiryTimestamp).isValid() || moment().isAfter(payload.expiryTimestamp);
      if (isExpired) return null;
    }

    return { userId, role: payload.role, permissions: payload.permissions };
  } catch (error) {
    // Invalid or malformed JWT; treat caller as unauthenticated (401).
    return null;
  }
};

/**
 * Guards the LB dashboard admin routes. It verifies the JWT or active session itself
 * (instead of relying on the global auth middleware) so unauthenticated and non-admin callers
 * get the documented bodies:
 * 401 { error: 'Authentication required' } and 403 { error: 'Admin access required' }.
 */
const requireLBAdmin = (req, res, next) => {
  const authHeader =
    typeof req.header === 'function' ? req.header('Authorization') : req.headers?.authorization;

  let resolvedUser = null;

  if (authHeader !== undefined) {
    const token = getToken(authHeader);
    const verified = token ? verifyPayload(token) : null;
    if (!verified) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    resolvedUser = {
      requestorId: verified.userId,
      role: verified.role,
      permissions: verified.permissions,
    };
  } else if (req.user) {
    resolvedUser = req.user;
  } else if (req.session?.user) {
    resolvedUser = req.session.user;
  }

  if (!resolvedUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!ADMIN_ROLES.includes(resolvedUser.role) && !resolvedUser.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.user = resolvedUser;
  return next();
};

module.exports = { requireLBAdmin, ADMIN_ROLES };
