const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const middleware = require('../middleware');

// The Bluesky auto-poster routes used to skip the global JWT check entirely, so anyone who could
// reach the API could connect an account, post (with an image upload) or delete posts without
// logging in. These requests now go through the same check as every other protected route.
describe('global auth middleware: /api/bluesky', () => {
  let app;
  const reached = jest.fn();

  const tokenFor = (overrides = {}) =>
    jwt.sign(
      {
        userid: '507f1f77bcf86cd799439011',
        role: 'Administrator',
        permissions: { frontPermissions: [] },
        expiryTimestamp: new Date(Date.now() + 60000).toISOString(),
        ...overrides,
      },
      config.JWT_SECRET,
    );

  beforeAll(() => {
    app = express();
    middleware(app);
    // Stand-ins for the real Bluesky routes: only the auth decision is under test here.
    app.all('/api/bluesky/*', (req, res) => {
      reached(req.user);
      res.status(200).json({ ok: true });
    });
  });

  beforeEach(() => reached.mockClear());

  it.each([
    ['GET', '/api/bluesky/session'],
    ['GET', '/api/bluesky/posts'],
    ['POST', '/api/bluesky/connect'],
    ['POST', '/api/bluesky/post'],
    ['POST', '/api/bluesky/disconnect'],
    ['DELETE', '/api/bluesky/post/at%3A%2F%2Fexample'],
  ])('rejects %s %s without a token', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path);
    expect(res.status).toBe(401);
    expect(reached).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    const res = await request(app)
      .get('/api/bluesky/session')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(reached).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    const expired = tokenFor({ expiryTimestamp: new Date(Date.now() - 1000).toISOString() });
    const res = await request(app).get('/api/bluesky/session').set('Authorization', expired);
    expect(res.status).toBe(401);
    expect(reached).not.toHaveBeenCalled();
  });

  it.each([
    ['a raw token', (t) => t],
    ['a Bearer token', (t) => `Bearer ${t}`],
  ])('lets a logged-in user through with %s and attaches the requestor', async (_label, format) => {
    const res = await request(app)
      .get('/api/bluesky/session')
      .set('Authorization', format(tokenFor()));
    expect(res.status).toBe(200);
    expect(reached).toHaveBeenCalledWith(
      expect.objectContaining({ requestorId: '507f1f77bcf86cd799439011', role: 'Administrator' }),
    );
  });
});
