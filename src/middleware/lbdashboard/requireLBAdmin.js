const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../../config');

const ADMIN_ROLES = ['Administrator', 'Owner', 'Admin', 'admin'];

const getToken = (authHeader) => {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const trimmed = authHeader.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    const token = trimmed.slice(7).trim();
    return token || null;
  }
  return trimmed;
};

const verifyPayload = (token) => {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    if (!payload || typeof payload !== 'object') return null;

    if (payload.expiryTimestamp !== undefined) {
      const hasValidTimestamp =
        payload.expiryTimestamp && moment(payload.expiryTimestamp).isValid();
      const isExpired = !hasValidTimestamp || moment().isAfter(payload.expiryTimestamp);
      if (isExpired) return null;
    }

    const userId = payload.userid || payload.userId || payload.id || payload._id || payload.sub;
    const hasRoleOrAdminFlag = Boolean(payload.role) || typeof payload.isAdmin === 'boolean';
    if (!userId && !hasRoleOrAdminFlag) return null;
    if (payload.expiryTimestamp !== undefined && (!userId || !payload.role)) return null;

    return payload;
  } catch (error) {
    return null;
  }
};

const isAdminUser = (userObj) => {
  if (!userObj || typeof userObj !== 'object') return false;
  if (userObj.isAdmin === true) return true;
  if (typeof userObj.role === 'string') {
    const normalized = userObj.role.trim().toLowerCase();
    return ['administrator', 'owner', 'admin', 'superadmin'].includes(normalized);
  }
  return false;
};

/**
 * Guards the LB dashboard admin routes. It verifies the JWT or active session itself
 * (instead of relying on the global auth middleware) so unauthenticated and non-admin callers
 * get the documented bodies:
 * 401 { error: 'Authentication required' } and 403 { error: 'Admin access required' }.
 */
const requireLBAdmin = (req, res, next) => {
  const authHeader =
    typeof req.header === 'function'
      ? req.header('Authorization')
      : req.headers && (req.headers.authorization || req.headers.Authorization);

  let resolvedUser = null;

  if (authHeader !== undefined && authHeader !== null) {
    const token = getToken(authHeader);
    const payload = token ? verifyPayload(token) : null;
    if (!payload) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    resolvedUser = {
      requestorId: payload.userid || payload.userId || payload.id || payload._id || payload.sub,
      role: payload.role,
      isAdmin: payload.isAdmin,
      permissions: payload.permissions,
    };
  } else if (req.user && typeof req.user === 'object') {
    resolvedUser = req.user;
  } else if (req.session && req.session.user && typeof req.session.user === 'object') {
    resolvedUser = req.session.user;
  }

  if (!resolvedUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!isAdminUser(resolvedUser)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.user = resolvedUser;
  return next();
};

module.exports = { requireLBAdmin, ADMIN_ROLES };
