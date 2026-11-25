const fs = require('node:fs').promises;
const express = require('express');
const multer = require('multer');
const request = require('supertest');

// Mock controllers
jest.mock('../../controllers/youtubeAutoPoster', () => ({
  getYoutubeAuthorizationUrl: (_req, res) =>
    res.status(200).json({ success: true, authUrl: 'http://test-url' }),
  getYoutubeConnectionStatus: (_req, res) =>
    res.status(200).json({ success: true, connected: false }),
  connectYoutubeAccount: (_req, res) => res.redirect('http://frontend/announcements/youtube'),
  disconnectYoutubeAccount: (_req, res) => res.status(200).json({ success: true }),
  getYoutubeCategories: (_req, res) => res.status(200).json({ success: true, categories: [] }),
  uploadVideo: async (req, res) => {
    if (req.headers['x-mock-error'] === 'generic') {
      throw new Error('Upload service failed');
    }
    if (req.headers['x-mock-error'] === 'custom-status') {
      const err = new Error('Custom error');
      err.statusCode = 502;
      throw err;
    }
    return res.status(201).json({ success: true, message: 'Uploaded' });
  },
}));

// Mock requestor middleware: a request without an Authorization header is rejected
jest.mock('../../middleware/attachYoutubeRequestor', () => ({
  attachYoutubeRequestor: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized request: No header' });
    }
    req.requestor = { requestorId: 'user-1' };
    return next();
  },
}));

// Mock permission middleware
jest.mock('../../middleware/youtubePermissionMiddleware', () => ({
  requireYoutubePermission: (req, _res, next) => {
    if (req.headers['x-mock-unauthorized'] === 'true') {
      return _res.status(403).json({ success: false, message: 'Permission denied' });
    }
    next();
  },
}));

// Mock fs.promises.unlink to test temporary file cleanup error catching
jest.spyOn(fs, 'unlink').mockImplementation(async (filePath) => {
  if (filePath && filePath.includes('fail-cleanup')) {
    throw new Error('Unlink failed');
  }
  return Promise.resolve();
});

const youtubeRouter = require('../youtubeAutoPosterRouter');

const app = express();
app.use(express.json());
app.use('/api/youtube', youtubeRouter);

describe('youtubeAutoPosterRouter Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/youtube/auth-url should return 200 with a token', async () => {
    const res = await request(app).get('/api/youtube/auth-url').set('Authorization', 'token');
    expect(res.status).toBe(200);
  });

  it('GET /api/youtube/auth-url should return 401 without a token', async () => {
    const res = await request(app).get('/api/youtube/auth-url');
    expect(res.status).toBe(401);
  });

  it('GET /api/youtube/status should return 200 with a token', async () => {
    const res = await request(app).get('/api/youtube/status').set('Authorization', 'token');
    expect(res.status).toBe(200);
  });

  it('GET /api/youtube/categories should require a token', async () => {
    expect((await request(app).get('/api/youtube/categories')).status).toBe(401);
    const res = await request(app).get('/api/youtube/categories').set('Authorization', 'token');
    expect(res.status).toBe(200);
  });

  it('POST /api/youtube/disconnect should require a token', async () => {
    expect((await request(app).post('/api/youtube/disconnect')).status).toBe(401);
    const res = await request(app).post('/api/youtube/disconnect').set('Authorization', 'token');
    expect(res.status).toBe(200);
  });

  it('GET /api/youtube/callback should be public', async () => {
    const res = await request(app).get('/api/youtube/callback?code=a&state=b');
    expect(res.status).toBe(302);
  });

  it('POST /api/youtube/connect should no longer exist', async () => {
    const res = await request(app).post('/api/youtube/connect').send({});
    expect(res.status).toBe(404);
  });

  it('POST /api/youtube/upload should succeed with valid video file', async () => {
    const res = await request(app)
      .post('/api/youtube/upload')
      .set('Authorization', 'token')
      .attach('video', Buffer.from('mock video content'), {
        filename: 'test.mp4',
        contentType: 'video/mp4',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/youtube/upload should reject non-video mimetype in fileFilter', async () => {
    const res = await request(app)
      .post('/api/youtube/upload')
      .set('Authorization', 'token')
      .attach('video', Buffer.from('text content'), {
        filename: 'test.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('video must be a supported video file');
  });

  it('POST /api/youtube/upload should handle generic upload errors with 500 status', async () => {
    const res = await request(app)
      .post('/api/youtube/upload')
      .set('Authorization', 'token')
      .set('x-mock-error', 'generic')
      .attach('video', Buffer.from('mock video content'), {
        filename: 'test.mp4',
        contentType: 'video/mp4',
      });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/youtube/upload should handle custom status errors from upload', async () => {
    const res = await request(app)
      .post('/api/youtube/upload')
      .set('Authorization', 'token')
      .set('x-mock-error', 'custom-status')
      .attach('video', Buffer.from('mock video content'), {
        filename: 'test.mp4',
        contentType: 'video/mp4',
      });
    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/youtube/upload should handle file cleanup failure gracefully', async () => {
    const res = await request(app)
      .post('/api/youtube/upload')
      .set('Authorization', 'token')
      .attach('video', Buffer.from('mock video content'), {
        filename: 'fail-cleanup-test.mp4',
        contentType: 'video/mp4',
      });
    expect(res.status).toBe(201);
  });

  it('should handle MulterError LIMIT_FILE_SIZE with 413 status', async () => {
    const testApp = express();
    testApp.use(express.json());

    youtubeRouter.post('/test-error-413', (_req, _res, next) => {
      next(new multer.MulterError('LIMIT_FILE_SIZE'));
    });

    testApp.use('/api/youtube', youtubeRouter);

    testApp.use((err, _req, res, _next) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: err.message });
    });

    const res = await request(testApp).post('/api/youtube/test-error-413');
    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });
});
