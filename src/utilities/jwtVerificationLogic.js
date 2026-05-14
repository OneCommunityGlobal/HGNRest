const moment = require('moment');
const jwt = require('jsonwebtoken');
const config = require('../config');

const jwtVerificationLogic = (authHeader, res) => {
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized request: No header' });
  }

  let authToken = authHeader;
  // If it has Bearer, strip it. If not, use it as is.
  if (authHeader.startsWith('Bearer ')) {
    [, authToken] = authHeader.split(' ');
  }

  let payload;
  try {
    payload = jwt.verify(authToken, config.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token', details: error.message });
  }

  // Ensure mock date in test is not in the past
  const isExpired = moment().isAfter(payload.expiryTimestamp);
  if (!payload.userid || !payload.role || isExpired) {
    // eslint-disable-next-line no-console
    console.log('Auth failed. Expiry:', payload.expiryTimestamp);
    return res.status(401).send('Unauthorized request: Token expired or invalid payload');
  }

  return payload;
};

module.exports = jwtVerificationLogic;
