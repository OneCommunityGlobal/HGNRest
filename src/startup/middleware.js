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
      (req.originalUrl === '/api/login'
        || req.originalUrl === '/api/forgotpassword')
      && req.method === 'POST'
    ) {
      next();
      return;
    }
    if (req.originalUrl === '/api/forcepassword' && req.method === 'PATCH') {
      next();
      return;
    }
    if (!req.header('Authorization')) {
      res.status(401).send({ 'error:': 'Unauthorized request' });
      return;
    }

    const authToken = req.header(config.REQUEST_AUTHKEY);

    let payload = '';

    try {
      payload = jwt.verify(authToken, config.JWT_SECRET);
    } catch (error) {
      res.status(401).send('Invalid token');
      return;
    }

    if (
      !payload
      || !payload.expiryTimestamp
      || !payload.userid
      || !payload.role
      // || moment().isAfter(payload.expiryTimestamp)
    ) {
      res.status(401).send('Unauthorized request');
      return;
    }

    const requestor = {};
    requestor.requestorId = payload.userid;
    requestor.role = payload.role;
    requestor.permissions = payload.permissions;

    req.body.requestor = requestor;
    next();
  });
};
