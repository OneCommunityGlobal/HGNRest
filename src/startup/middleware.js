/* eslint-disable complexity */
/* eslint-disable no-magic-numbers */
const jwt = require('jsonwebtoken');
const moment = require('moment');
const express = require('express');
const config = require('../config');
const webhookController = require('../controllers/lbdashboard/webhookController'); // your new controller
const { Bids } = require('../models/lbdashboard/bids'); // or wherever you're getting Bids

const { webhookTest } = webhookController(Bids);

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
    // 🔹 Allow unauthenticated access for Mastodon test APIs
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

    // Public analytics tracking endpoints (no auth required)
    if (
      (req.originalUrl === '/api/applicant-analytics/track-interaction' ||
        req.originalUrl === '/api/applicant-analytics/track-application') &&
      req.method === 'POST'
    ) {
      next();
      return;
    }

    // Skip auth check for PayPal webhook route

    if (openPaths.includes(req.path)) {
      return next(); // Allow PayPal requests through
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
  app.post('/api/lb/myWebhooks/', paypalAuthMiddleware, webhookTest);
};
