const jwt = require('jsonwebtoken');

const mockWebhookTest = jest.fn();

jest.mock('../../config', () => ({
  REQUEST_AUTHKEY: 'Authorization',
  JWT_SECRET: 'test-secret',
}));

jest.mock('../../controllers/lbdashboard/webhookController', () =>
  jest.fn(() => ({
    webhookTest: mockWebhookTest,
  })),
);

jest.mock('../../models/lbdashboard/bids', () => ({
  Bids: {},
}));

jest.mock('moment', () =>
  jest.fn(() => ({
    isAfter: jest.fn((timestamp) => Date.now() > timestamp),
  })),
);

const middleware = require('../middleware');

describe('middleware', () => {
  let app;
  let allHandler;
  let paypalMiddleware;
  let webhookHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    app = {
      use: jest.fn(),
      all: jest.fn((path, handler) => {
        if (path === '*') {
          allHandler = handler;
        }
      }),
      post: jest.fn((path, ...handlers) => {
        [paypalMiddleware, webhookHandler] = handlers;
      }),
    };

    middleware(app);
  });

  const createRequest = (overrides = {}) => ({
    originalUrl: '/',
    path: '/',
    method: 'GET',
    body: {},
    header: jest.fn(),
    ...overrides,
  });

  const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    json: jest.fn(),
  });

  describe('configuration', () => {
    it('should configure JSON and URL encoded body parsers', () => {
      expect(app.use).toHaveBeenCalledTimes(2);
      expect(app.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should register catch-all middleware', () => {
      expect(app.all).toHaveBeenCalledWith('*', expect.any(Function));
      expect(allHandler).toBeDefined();
    });

    it('should register PayPal webhook route', () => {
      expect(app.post).toHaveBeenCalledWith(
        '/api/lb/myWebhooks/',
        expect.any(Function),
        mockWebhookTest,
      );

      expect(paypalMiddleware).toBeDefined();
      expect(webhookHandler).toBe(mockWebhookTest);
    });
  });

  describe('public routes', () => {
    it('should allow Mastodon API requests without authentication', () => {
      const req = createRequest({
        originalUrl: '/api/mastodon/test',
        path: '/api/mastodon/test',
      });
      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return homepage for root route', () => {
      const req = createRequest({
        originalUrl: '/',
        path: '/',
      });
      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('This is the homepage for rest services');
      expect(next).not.toHaveBeenCalled();
    });

    it.each([
      ['/api/login', 'POST'],
      ['/api/forgotpassword', 'POST'],
      ['/api/lbdashboard/register', 'POST'],
      ['/api/forcepassword', 'PATCH'],
      ['/api/ProfileInitialSetup', 'POST'],
      ['/api/validateToken', 'POST'],
      ['/api/getTimeZoneAPIKeyByToken', 'POST'],
      ['/api/getTotalCountryCount', 'GET'],
      ['/api/timezone/test', 'POST'],
      ['/api/add-non-hgn-email-subscription', 'GET'],
      ['/api/confirm-non-hgn-email-subscription', 'GET'],
      ['/api/remove-non-hgn-email-subscription', 'POST'],
      ['/api/jobs/test', 'GET'],
      ['/api/jobforms/123/responses', 'POST'],
      ['/api/bluesky/test', 'GET'],
      ['/api/applicant-analytics/track-interaction', 'POST'],
      ['/api/applicant-analytics/track-application', 'POST'],
      ['/api/map-analytics/test', 'GET'],
      ['/api/analytics/country-applications/test', 'GET'],
      ['/api/analytics/roles', 'GET'],
      ['/applications/test', 'GET'],
      ['/api/lb/myWebhooks', 'GET'],
    ])('should allow %s %s without authentication', (originalUrl, method) => {
      const req = createRequest({
        originalUrl,
        path: originalUrl,
        method,
      });
      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should not allow POST /api/jobs without authentication', () => {
      const req = createRequest({
        originalUrl: '/api/jobs',
        path: '/api/jobs',
        method: 'POST',
        header: jest.fn(() => undefined),
      });

      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({
        'error:': 'Unauthorized request',
      });
    });

    it('should not allow POST /api/analytics/roles without authentication', () => {
      const req = createRequest({
        originalUrl: '/api/analytics/roles',
        path: '/api/analytics/roles',
        method: 'POST',
        header: jest.fn(() => undefined),
      });

      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('server time endpoint', () => {
    it('should allow GET /api/servertime without authentication', () => {
      const req = createRequest({
        originalUrl: '/api/servertime',
        path: '/api/servertime',
        method: 'GET',
      });

      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(req.header).not.toHaveBeenCalled();
    });

    it('should require authentication for POST /api/servertime', () => {
      const req = createRequest({
        originalUrl: '/api/servertime',
        path: '/api/servertime',
        method: 'POST',
        header: jest.fn(() => undefined),
      });

      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({
        'error:': 'Unauthorized request',
      });
    });
  });

  describe('authentication', () => {
    const createAuthenticatedRequest = () => ({
      originalUrl: '/api/protected',
      path: '/api/protected',
      method: 'GET',
      body: {},
      header: jest.fn((name) => {
        if (name === 'Authorization') {
          return 'valid-token';
        }

        return undefined;
      }),
    });

    it('should reject request without Authorization header', () => {
      const req = createRequest({
        originalUrl: '/api/protected',
        path: '/api/protected',
        method: 'GET',
        header: jest.fn(() => undefined),
      });

      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({
        'error:': 'Unauthorized request',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT', () => {
      const verifySpy = jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const req = createAuthenticatedRequest();
      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(verifySpy).toHaveBeenCalledWith('valid-token', 'test-secret');

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('Invalid token');
      expect(next).not.toHaveBeenCalled();

      verifySpy.mockRestore();
    });

    it('should reject request when JWT payload is missing', () => {
      const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValueOnce(null);

      const req = createAuthenticatedRequest();
      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('Unauthorized request');
      expect(next).not.toHaveBeenCalled();

      verifySpy.mockRestore();
    });

    it('should reject request when expiryTimestamp is missing', () => {
      const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValueOnce({
        userid: 'user123',
        role: 'admin',
        permissions: [],
      });

      const req = createAuthenticatedRequest();
      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('Unauthorized request');
      expect(next).not.toHaveBeenCalled();

      verifySpy.mockRestore();
    });

    it('should reject request when userid is missing', () => {
      const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValueOnce({
        expiryTimestamp: Date.now() + 60000,
        role: 'admin',
        permissions: [],
      });

      const req = createAuthenticatedRequest();
      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('Unauthorized request');
      expect(next).not.toHaveBeenCalled();

      verifySpy.mockRestore();
    });

    it('should reject request when role is missing', () => {
      const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValueOnce({
        expiryTimestamp: Date.now() + 60000,
        userid: 'user123',
        permissions: [],
      });

      const req = createAuthenticatedRequest();
      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('Unauthorized request');
      expect(next).not.toHaveBeenCalled();

      verifySpy.mockRestore();
    });

    it('should reject expired JWT', () => {
      const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValueOnce({
        expiryTimestamp: Date.now() - 60000,
        userid: 'user123',
        role: 'admin',
        permissions: [],
      });

      const req = createAuthenticatedRequest();
      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('Unauthorized request');
      expect(next).not.toHaveBeenCalled();

      verifySpy.mockRestore();
    });

    it('should allow a valid authenticated request', () => {
      const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValueOnce({
        expiryTimestamp: Date.now() + 60000,
        userid: 'user123',
        role: 'admin',
        permissions: ['read'],
      });

      const req = createAuthenticatedRequest();
      const res = createResponse();
      const next = jest.fn();

      allHandler(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);

      expect(req.body.requestor).toEqual({
        requestorId: 'user123',
        role: 'admin',
        permissions: ['read'],
      });

      verifySpy.mockRestore();
    });
  });

  describe('PayPal authentication middleware', () => {
    it('should reject request when PayPal auth header is missing', () => {
      const req = {
        header: jest.fn(() => undefined),
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const next = jest.fn();

      paypalMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(501);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing PayPal-Auth-Algo header',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow request when PayPal auth header exists', () => {
      const req = {
        header: jest.fn(() => 'HMAC-SHA256'),
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const next = jest.fn();

      paypalMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
