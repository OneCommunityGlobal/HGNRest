const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');

const webhookController = require('../controllers/lbdashboard/webhookController'); // your new controller

const { Bids } = require('../models/lbdashboard/bids'); // or wherever you're getting Bids

const { webhookTest } = webhookController(Bids);

const paypalAuthMiddleware = (req, res, next) => {
  const authHeader = req.header('Paypal-Auth-Algo');
  console.log('Paypal-Auth-Algo:', authHeader);
  if (!authHeader) {
    return res.status(501).json({ error: 'Missing PayPal-Auth-Algo header' });
  }
  next();
};

// Socket.IO middleware
function socketMiddleware(socket, next) {
  const { token } = socket.handshake.auth;
  console.log(' Token received:', token);

  if (token === 'secret123') {
    return next();
  }
  return next(new Error('Invalid token'));
}

module.exports = function (app) {
  app.all('*', (req, res, next) => {
    const openPaths = ['/api/lb/myWebhooks'];

    console.log(req.path);
    console.log(req.header);
    console.log(req.body);
    console.log('Middleware running for path:', req.path);
    console.log('openPaths:', openPaths);
    console.log('Path match check:', openPaths.includes(req.path));

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

    // Skip auth check for PayPal webhook route

    if (openPaths.includes(req.path)) {
      console.log('included before next');
      // res.status(200).send({ 'Success:': 'True' });

      return next(); // Allow PayPal requests through
      // return;
    }
    console.log('before Authorization ');
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
      !payload ||
      !payload.expiryTimestamp ||
      !payload.userid ||
      !payload.role ||
      moment().isAfter(payload.expiryTimestamp)
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
  // Apply PayPal middleware only to specific route
  console.log('before api/lb/myWebhooks');
  app.post('/api/lb/myWebhooks/', paypalAuthMiddleware, webhookTest);
};
module.exports = function (socket) {
  // socket('io', (next) => {
  // console.log(socket);
  //   const { token } = socket.handshake.auth;
  console.log(' Token received:');

  /* if (token === 'secret123') {
    return true;
  }
  return false; // next(new Error('Invalid token'));
*/
};
