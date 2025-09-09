const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');

module.exports = function (app) {
  app.all('*', (req, res, next) => {
    if (req.originalUrl === '/') {
      res.status(200).send('This is the homepage for rest services');
      return;
    }

    if (
      (req.originalUrl === '/api/login' || req.originalUrl === '/api/forgotpassword') &&
      req.method === 'POST'
    ) {
      next();
      return;
    }
    if (req.originalUrl === '/api/forcepassword' && req.method === 'PATCH') {
      next();
      return;
    }
    if (
      ((req.originalUrl === '/api/ProfileInitialSetup' ||
        req.originalUrl === '/api/validateToken' ||
        req.originalUrl === '/api/getTimeZoneAPIKeyByToken') &&
        req.method === 'POST') ||
      (req.originalUrl === '/api/getTotalCountryCount' && req.method === 'GET') ||
      (req.originalUrl.includes('/api/timezone') && req.method === 'POST')
    ) {
      next();
      return;
    }
    if (
      req.originalUrl === '/api/add-non-hgn-email-subscription' ||
      req.originalUrl === '/api/confirm-non-hgn-email-subscription' ||
      (req.originalUrl === '/api/remove-non-hgn-email-subscription' && req.method === 'POST')
    ) {
      next();
      return;
    }
    if (req.originalUrl.startsWith('/api/jobs') && req.method === 'GET') {
      next();
      return;
    }

    // Get authentication token
    const authToken = req.header('Authorization');
    if (!authToken) {
      res.status(401).send({ error: 'Unauthorized request - No token provided' });
      return;
    }

    try {
      const payload = jwt.verify(authToken, config.JWT_SECRET);
      
      if (
        !payload ||
        !payload.expiryTimestamp ||
        !payload.userid ||
        !payload.role ||
        moment().isAfter(payload.expiryTimestamp)
      ) {
        res.status(401).send({ error: 'Unauthorized request - Invalid token payload' });
        return;
      }

      // Add requestor information to request body
      req.body.requestor = {
        requestorId: payload.userid,
        role: payload.role,
        permissions: payload.permissions
      };
      
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).send({ error: 'Invalid token' });
    }
  });
};
