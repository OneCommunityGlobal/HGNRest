/* eslint-disable complexity */
/* eslint-disable no-magic-numbers */

const express = require('express');
const webhookController = require('../controllers/lbdashboard/webhookController'); // your new controller
const { Bids } = require('../models/lbdashboard/bids'); // or wherever you're getting Bids

const { webhookTest } = webhookController(Bids);

const {jwtVerificationLogic} = require('../utilities/jwtVerificationLogic');

const paypalAuthMiddleware = (req, res, next) => {
  const authHeader = req.header('Paypal-Auth-Algo');
  if (!authHeader) {
    return res.status(501).json({ error: 'Missing PayPal-Auth-Algo header' });
  }
  next();
};

/* Socket.IO middleware
function socketMiddleware(socket, next) {
  const { token } = socket.handshake.auth;

  if (token === 'secret123') {
    return next();
  }
  return next(new Error('Invalid token'));
}
*/
module.exports = function (app) {
  // Increase request size limit for image uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.all('*', (req, res, next) => {
    // Allow unauthenticated access for Mastodon test APIs
    if (req.originalUrl.startsWith('/api/mastodon')) {
      return next();
    }
    const openPaths = ['/api/lb/myWebhooks'];

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

    if (req.originalUrl.startsWith('/api/bluesky')) {
      next();
      return;
    }

    // Public analytics tracking endpoints (no auth required)
    if (
      (req.originalUrl === '/api/applicant-analytics/track-interaction' ||
        req.originalUrl === '/api/applicant-analytics/track-application') &&
      req.method === 'POST'
    ) {
      next();
      return;
    }

    // Public map analytics endpoints (no auth required for GET requests)
    if (req.originalUrl.startsWith('/api/map-analytics') && req.method === 'GET') {
      next();
      return;
    }

    // Public country analytics endpoints (no auth required for GET requests)
    if (req.originalUrl.startsWith('/api/analytics/country-applications') && req.method === 'GET') {
      next();
      return;
    }

    // Public roles endpoint (no auth required for GET requests)
    if (req.originalUrl === '/api/analytics/roles' && req.method === 'GET') {
      next();
      return;
    }

    // Public applications analytics endpoints (no auth required for GET requests)
    if (req.originalUrl.startsWith('/applications') && req.method === 'GET') {
      next();
      return;
    }

    // Skip auth check for PayPal webhook route

    if (openPaths.includes(req.path)) {
      return next(); // Allow PayPal requests through
    }
    
    //  HEADER EXTRACTION
    const authHeader = req.header('Authorization');
    const payload = jwtVerificationLogic(authHeader,res);

    //  ATTACH DATA & CONTINUE
    const requestor = {
      requestorId: payload.userid,
      role: payload.role,
      permissions: payload.permissions
    };

    req.user = requestor; 
    
    if (req.body) {
      req.body.requestor = requestor;
    }

    //console.log(`Auth Success: ${payload.userid} accessing ${req.originalUrl}`);
    
    return next();
  });

  // PROTECTED ROUTES
  app.post('/api/lb/myWebhooks/', paypalAuthMiddleware, webhookTest);
};