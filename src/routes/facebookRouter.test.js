const express = require('express');
// eslint-disable-next-line import/order
const request = require('supertest');

jest.mock('../controllers/facebookController', () => ({
  postToFacebook: jest.fn((req, res) => res.status(200).send({ success: true })),
  postToFacebookWithImage: jest.fn((req, res) => res.status(200).send({ success: true })),
  scheduleFacebookPost: jest.fn((req, res) => res.status(200).send({ success: true })),
  scheduleFacebookPostWithImage: jest.fn((req, res) => res.status(200).send({ success: true })),
  getScheduledPosts: jest.fn((req, res) => res.status(200).send({ success: true })),
  getPostHistory: jest.fn((req, res) => res.status(200).send({ success: true })),
  cancelScheduledPost: jest.fn((req, res) => res.status(200).send({ success: true })),
  updateScheduledPost: jest.fn((req, res) => res.status(200).send({ success: true })),
}));

jest.mock('../controllers/facebookAuthController', () => ({
  getConnectionStatus: jest.fn(),
  handleAuthCallback: jest.fn(),
  connectPage: jest.fn(),
  disconnectPage: jest.fn(),
  verifyConnection: jest.fn(),
}));

const facebookController = require('../controllers/facebookController');
const facebookRoutes = require('./facebookRouter');

const makeApp = () => {
  const app = express();
  app.use('/api', facebookRoutes());
  app.use((error, req, res, next) => {
    res.status(400).send({ error: error.message });
  });
  return app;
};

describe('facebookRouter image upload restrictions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['image/jpeg', 'photo.jpg'],
    ['image/png', 'photo.png'],
    ['image/gif', 'photo.gif'],
    ['image/webp', 'photo.webp'],
  ])('accepts the existing %s image type', async (mimeType, filename) => {
    const response = await request(makeApp())
      .post('/api/social/facebook/post/upload')
      .attach('image', Buffer.from('image'), { filename, contentType: mimeType });

    expect(response.status).toBe(200);
    expect(facebookController.postToFacebookWithImage).toHaveBeenCalledTimes(1);
  });

  it('rejects a MIME type outside the image allow-list', async () => {
    const response = await request(makeApp())
      .post('/api/social/facebook/post/upload')
      .attach('image', Buffer.from('not-an-image'), {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Only JPEG, PNG, GIF, and WebP images are allowed');
    expect(facebookController.postToFacebookWithImage).not.toHaveBeenCalled();
  });

  it('rejects a single image larger than the existing 10 MB contract', async () => {
    const response = await request(makeApp())
      .post('/api/social/facebook/post/upload')
      .attach('image', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'oversized.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('File too large');
    expect(facebookController.postToFacebookWithImage).not.toHaveBeenCalled();
  });
});
