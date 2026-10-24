const request = require('supertest');
const express = require('express');

jest.mock('../../controllers/youtubeAutoPoster', () => ({
  getYoutubeAuthorizationUrl: (req, res) =>
    res.status(200).json({ success: true, authUrl: 'http://test-url' }),
  getYoutubeConnectionStatus: (req, res) =>
    res.status(200).json({ success: true, connected: false }),
  connectYoutubeAccount: (req, res) => res.status(200).json({ success: true, connected: true }),
  uploadVideo: (req, res) => res.status(201).json({ success: true, message: 'Uploaded' }),
}));

jest.mock('../../middleware/youtubePermissionMiddleware', () => ({
  requireYoutubePermission: (req, res, next) => {
    if (req.headers['x-mock-unauthorized'] === 'true') {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }
    next();
  },
}));

const youtubeRouter = require('../youtubeAutoPosterRouter');

const app = express();
app.use(express.json());
app.use('/api/youtube', youtubeRouter);

describe('youtubeAutoPosterRouter Tests', () => {
  it('GET /api/youtube/auth-url should return 200', async () => {
    const res = await request(app).get('/api/youtube/auth-url');
    expect(res.status).toBe(200);
  });

  it('GET /api/youtube/status should return 200', async () => {
    const res = await request(app).get('/api/youtube/status');
    expect(res.status).toBe(200);
  });

  it('POST /api/youtube/connect should be blocked when unauthorized', async () => {
    const res = await request(app)
      .post('/api/youtube/connect')
      .set('x-mock-unauthorized', 'true')
      .send({ code: 'test', state: 'test' });
    expect(res.status).toBe(403);
  });

  it('POST /api/youtube/connect should succeed when authorized', async () => {
    const res = await request(app)
      .post('/api/youtube/connect')
      .send({ code: 'test', state: 'test' });
    expect(res.status).toBe(200);
  });
});
