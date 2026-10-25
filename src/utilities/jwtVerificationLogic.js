const moment = require('moment');
const jwt = require('jsonwebtoken');
const config = require('../config');

const jwtVerificationLogic = (authHeader, res) => {
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized request: No header' });
  }

  let authToken = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    [, authToken] = authHeader.split(' ');
  }

  let payload;
  try {
    payload = jwt.verify(authToken, config.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  // Checking if expiryTimestamp exists and is valid
  const hasValidTimestamp = payload.expiryTimestamp && moment(payload.expiryTimestamp).isValid();
  const isExpired = !hasValidTimestamp || moment().isAfter(payload.expiryTimestamp);

  if (!payload.userid || !payload.role || isExpired) {
    return res.status(401).send('Unauthorized request: Token expired or invalid payload');
  }

  return payload;
};

module.exports = jwtVerificationLogic;
