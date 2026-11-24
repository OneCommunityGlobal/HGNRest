/* eslint-disable no-magic-numbers */

const express = require('express');
const request = require('supertest');

jest.mock('../../controllers/lbdashboard/webhookController', () =>
  jest.fn(() => ({
    webhookTest: jest.fn((req, res) => res.status(200).json({ success: true })),
  })),
);

jest.mock('../../models/lbdashboard/bids', () => ({
  Bids: {},
}));

jest.mock('../../utilities/jwtVerificationLogic', () => jest.fn());

const jwtVerificationLogic = require('../../utilities/jwtVerificationLogic');
const middleware = require('../middleware');

describe('middleware', () => {
  let app;

  const validPayload = {
    userid: 'test-user-id',
    role: 'user',
    permissions: ['read'],
  };

  const expectedRequestor = {
    requestorId: validPayload.userid,
    role: validPayload.role,
    permissions: validPayload.permissions,
  };

  const createApp = (routeMethod = 'get', routePath = '/test-route') => {
    const testApp = express();

    middleware(testApp);

    testApp[routeMethod](routePath, (req, res) => {
      res.status(200).json({
        success: true,
        user: req.user || null,
        requestor: req.body?.requestor || null,
      });
    });

    return testApp;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jwtVerificationLogic.mockImplementation((authHeader, res) => {
      if (!authHeader) {
        res.status(401).json({ error: 'Unauthorized' });
        return undefined;
      }

      return validPayload;
    });

    app = createApp();
  });

  describe('homepage', () => {
    it('should return the homepage message', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.text).toBe('This is the homepage for rest services');
      expect(jwtVerificationLogic).not.toHaveBeenCalled();
    });
  });

  describe('public authentication routes', () => {
    it.each([
      ['/api/login', 'post'],
      ['/api/forgotpassword', 'post'],
      ['/api/lbdashboard/register', 'post'],
      ['/api/production-identity/public-verify', 'post'],
      ['/api/webhooks/production-user-status', 'post'],
      ['/api/forcepassword', 'patch'],
      ['/api/ProfileInitialSetup', 'post'],
      ['/api/validateToken', 'post'],
      ['/api/getTimeZoneAPIKeyByToken', 'post'],
      ['/api/getTotalCountryCount', 'get'],
      ['/api/timezone/test', 'post'],
      ['/api/add-non-hgn-email-subscription', 'get'],
      ['/api/confirm-non-hgn-email-subscription', 'get'],
      ['/api/remove-non-hgn-email-subscription', 'post'],
      ['/api/jobs', 'get'],
      ['/api/jobs/list', 'get'],
      ['/api/jobforms/all', 'get'],
      ['/api/jobforms/test-form', 'get'],
      ['/api/jobforms/test-form/responses', 'post'],
      ['/api/faqs', 'get'],
      ['/api/bluesky/test', 'get'],
      ['/api/applicant-analytics/track-interaction', 'post'],
      ['/api/applicant-analytics/track-application', 'post'],
      ['/api/map-analytics/summary', 'get'],
      ['/api/analytics/country-applications', 'get'],
      ['/api/analytics/roles', 'get'],
      ['/applications', 'get'],
      ['/api/servertime', 'get'],
    ])('should allow public %s requests using %s', async (path, method) => {
      const testApp = createApp(method, path);

      const response = await request(testApp)[method](path);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(jwtVerificationLogic).not.toHaveBeenCalled();
    });
  });

  describe('protected routes', () => {
    it('should reject requests without an authorization header', async () => {
      const response = await request(app).get('/test-route');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');

      expect(jwtVerificationLogic).toHaveBeenCalledWith(undefined, expect.anything());
    });

    it('should allow requests with a valid authorization header', async () => {
      const response = await request(app)
        .get('/test-route')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual(expectedRequestor);
    });

    it('should attach the requestor to req.body', async () => {
      const response = await request(app)
        .get('/test-route')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.requestor).toEqual(expectedRequestor);
    });

    it('should pass the authorization header to JWT verification', async () => {
      await request(app).get('/test-route').set('Authorization', 'Bearer valid-token');

      expect(jwtVerificationLogic).toHaveBeenCalledWith('Bearer valid-token', expect.anything());
    });

    it('should support protected POST requests', async () => {
      const postApp = createApp('post', '/protected-post');

      const response = await request(postApp)
        .post('/protected-post')
        .set('Authorization', 'Bearer valid-token')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual(expectedRequestor);
    });
  });

  describe('JWT verification failure', () => {
    it('should stop processing when JWT verification sends an error response', async () => {
      jwtVerificationLogic.mockImplementation((authHeader, res) => {
        res.status(401).json({ error: 'Invalid token' });
        return undefined;
      });

      const response = await request(app)
        .get('/test-route')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('PayPal webhook', () => {
    it('should allow webhook requests with the PayPal authentication header', async () => {
      const response = await request(app)
        .post('/api/lb/myWebhooks')
        .set('Paypal-Auth-Algo', 'SHA256');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(jwtVerificationLogic).not.toHaveBeenCalled();
    });

    it('should reject webhook requests without the PayPal authentication header', async () => {
      const response = await request(app).post('/api/lb/myWebhooks');

      expect(response.status).toBe(501);
      expect(response.body.error).toBe('Missing PayPal-Auth-Algo header');
      expect(jwtVerificationLogic).not.toHaveBeenCalled();
    });
  });

  describe('request body handling', () => {
    it('should preserve request body data when attaching requestor', async () => {
      const postApp = express();

      middleware(postApp);

      postApp.post('/protected-body', (req, res) => {
        res.status(200).json({
          success: true,
          name: req.body.name,
          requestor: req.body.requestor,
        });
      });

      const response = await request(postApp)
        .post('/protected-body')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('test');
      expect(response.body.requestor).toEqual(expectedRequestor);
    });
  });
});
