const moment = require('moment');
const jwt = require('jsonwebtoken');
const config = require('../config'); 

const jwtVerificationLogic = (authHeader) => {
  // 1. Check Header exists
  if (!authHeader) {
    throw new Error('No header');
  }

  // 2. Extract Token
  let authToken = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    // FIX: Array destructuring (Satisfies prefer-destructuring)
    [, authToken] = authHeader.split(' ');
  } else {
    throw new Error('Invalid token format');
  }

  // 3. Verify Token
  // jwt.verify throws an error automatically if secret is wrong or token is forged
  const payload = jwt.verify(authToken, config.JWT_SECRET);

  // 4. Validate Payload & Expiry
  const isExpired = moment().isAfter(payload.expiryTimestamp);
  if (!payload.userid || !payload.role || isExpired) {
    // FIX: eslint-disable (Satisfies no-console)
    // eslint-disable-next-line no-console
    console.log('Auth failed: Invalid payload or expired');
    throw new Error('Token expired or invalid payload');
  }

  return payload; 
};

// Satisfies import/prefer-default-export if your linter allows module.exports
module.exports = jwtVerificationLogic;