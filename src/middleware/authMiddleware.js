const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');

module.exports = function (req, res, next) {
  if (!req.header('Authorization')) {
    return res.status(401).send({ error: 'Unauthorized request' });
  }
  const authToken = req.header(config.REQUEST_AUTHKEY);
  let payload = '';
  try {
    payload = jwt.verify(authToken, config.JWT_SECRET);
  } catch (error) {
    return res.status(401).send('Invalid token');
  }
  if (
    !payload ||
    !payload.expiryTimestamp ||
    !payload.userid ||
    !payload.role ||
    moment().isAfter(payload.expiryTimestamp)
  ) {
    return res.status(401).send('Unauthorized request');
  }
  const requestor = {
    requestorId: payload.userid,
    role: payload.role,
    permissions: payload.permissions,
  };
    req.requestor = requestor;
    console.log('authMiddleware called, requestor:', requestor);
  next();
}; 