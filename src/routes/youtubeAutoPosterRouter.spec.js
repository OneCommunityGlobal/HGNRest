jest.mock('../controllers/youtubeAutoPoster', () => ({
  connectYoutubeAccount: jest.fn(),
  disconnectYoutubeAccount: jest.fn(),
  getYoutubeAuthorizationUrl: jest.fn(),
  getYoutubeConnectionStatus: jest.fn(),
  getYoutubeVideoCategories: jest.fn(),
  uploadVideo: jest.fn(),
}));

const {
  connectYoutubeAccount,
  disconnectYoutubeAccount,
  getYoutubeAuthorizationUrl,
  getYoutubeConnectionStatus,
  uploadVideo,
} = require('../controllers/youtubeAutoPoster');
const router = require('./youtubeAutoPosterRouter');

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('youtubeAutoPosterRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uploadVideo.mockImplementation((_req, res) =>
      res.status(201).json({ success: true, video: { id: 'youtube-video-id' } }),
    );
  });

  test('registers POST /upload behind Multer', () => {
    const routeLayer = router.stack.find((layer) => layer.route?.path === '/upload');

    expect(routeLayer).toBeDefined();
    expect(routeLayer.route.methods.post).toBe(true);
    expect(routeLayer.route.stack).toHaveLength(2);
  });

  test('registers the YouTube account connection endpoints', () => {
    const authUrlRoute = router.stack.find((layer) => layer.route?.path === '/auth-url');
    const connectRoute = router.stack.find((layer) => layer.route?.path === '/connect');
    const statusRoute = router.stack.find((layer) => layer.route?.path === '/status');
    const disconnectRoute = router.stack.find((layer) => layer.route?.path === '/disconnect');

    expect(authUrlRoute.route.methods.get).toBe(true);
    expect(authUrlRoute.route.stack[0].handle).toBe(getYoutubeAuthorizationUrl);
    expect(connectRoute.route.methods.post).toBe(true);
    expect(connectRoute.route.stack[0].handle).toBe(connectYoutubeAccount);
    expect(statusRoute.route.methods.get).toBe(true);
    expect(statusRoute.route.stack[0].handle).toBe(getYoutubeConnectionStatus);
    expect(disconnectRoute.route.methods.post).toBe(true);
    expect(disconnectRoute.route.stack[0].handle).toBe(disconnectYoutubeAccount);
  });

  test('delegates a parsed upload to the YouTube controller', async () => {
    const routeLayer = router.stack.find((layer) => layer.route?.path === '/upload');
    const controllerHandler = routeLayer.route.stack[1].handle;
    const req = {
      body: {
        metadata: JSON.stringify({ title: 'A video', categoryId: '22', madeForKids: false }),
      },
      file: {
        fieldname: 'video',
        mimetype: 'video/mp4',
      },
    };
    const res = makeResponse();
    const next = jest.fn();

    await controllerHandler(req, res, next);

    expect(uploadVideo).toHaveBeenCalledWith(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });
});
