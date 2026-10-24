const request = require('supertest');
const express = require('express');
const fs = require('node:fs').promises;
const multer = require('multer');

// Mock controllers
jest.mock('../../controllers/youtubeAutoPoster', () => ({
  getYoutubeAuthorizationUrl: (req, res) =>
    res.status(200).json({ success: true, authUrl: 'http://test-url' }),
  getYoutubeConnectionStatus: (req, res) =>
    res.status(200).json({ success: true, connected: false }),
  connectYoutubeAccount: (req, res) => res.status(200).json({ success: true, connected: true }),
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

// Mock permission middleware
jest.mock('../../middleware/youtubePermissionMiddleware', () => ({
  requireYoutubePermission: (req, res, next) => {
    if (req.headers['x-mock-unauthorized'] === 'true') {
      return res.status(403).json({ success: false, message: 'Permission denied' });
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

  it('POST /api/youtube/upload should succeed with valid video file', async () => {
    const res = await request(app)
      .post('/api/youtube/upload')
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
      .attach('video', Buffer.from('mock video content'), {
        filename: 'fail-cleanup-test.mp4',
        contentType: 'video/mp4',
      });
    expect(res.status).toBe(201);
  });

  it('should handle MulterError LIMIT_FILE_SIZE with 413 status', async () => {
    // Directly mock the upload middleware to invoke next with a MulterError
    const testApp = express();
    testApp.post('/api/youtube/upload', (req, res, next) => {
      const multerErr = new multer.MulterError('LIMIT_FILE_SIZE');
      next(multerErr);
    });
    testApp.use('/api/youtube', youtubeRouter);

    const res = await request(testApp).post('/api/youtube/upload');
    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });
});