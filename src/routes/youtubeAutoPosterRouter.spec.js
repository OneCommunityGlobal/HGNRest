const mockUnlink = jest.fn();
const mockTmpdir = jest.fn(() => '/tmp/youtube-uploads');
const mockRandomUUID = jest.fn(() => 'fixed-uuid');
const mockUploadVideo = jest.fn();
const mockUploadMiddleware = jest.fn();

class MockMulterError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

const mockMulter = jest.fn(() => ({
  single: jest.fn(() => mockUploadMiddleware),
}));
mockMulter.diskStorage = jest.fn((options) => options);
mockMulter.MulterError = MockMulterError;

jest.mock('../controllers/youtubeAutoPoster', () => ({
  connectYoutubeAccount: jest.fn(),
  disconnectYoutubeAccount: jest.fn(),
  getYoutubeAuthorizationUrl: jest.fn(),
  getYoutubeConnectionStatus: jest.fn(),
  getYoutubeVideoCategories: jest.fn(),
  uploadVideo: mockUploadVideo,
}));

jest.mock('node:fs', () => ({
  promises: {
    unlink: mockUnlink,
  },
}));

jest.mock('node:os', () => ({
  tmpdir: mockTmpdir,
}));

jest.mock('node:crypto', () => ({
  randomUUID: mockRandomUUID,
}));

jest.mock('multer', () => mockMulter);

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const loadRouter = (configuredMaxUploadBytes) => {
  if (configuredMaxUploadBytes === undefined) {
    delete process.env.YOUTUBE_MAX_UPLOAD_BYTES;
  } else {
    process.env.YOUTUBE_MAX_UPLOAD_BYTES = configuredMaxUploadBytes;
  }

  jest.resetModules();

  return require('./youtubeAutoPosterRouter');
};

const getUploadRoute = (router) => router.stack.find((layer) => layer.route?.path === '/upload');

const getErrorHandler = (router) => router.stack.find((layer) => layer.handle.length === 4).handle;

describe('youtubeAutoPosterRouter', () => {
  const originalMaxUploadBytes = process.env.YOUTUBE_MAX_UPLOAD_BYTES;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadVideo.mockImplementation((_req, res) =>
      res.status(201).json({ success: true, video: { id: 'youtube-video-id' } }),
    );
    mockUnlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalMaxUploadBytes === undefined) {
      delete process.env.YOUTUBE_MAX_UPLOAD_BYTES;
    } else {
      process.env.YOUTUBE_MAX_UPLOAD_BYTES = originalMaxUploadBytes;
    }
    jest.resetModules();
  });

  test('registers POST /upload behind Multer', () => {
    const router = loadRouter();
    const routeLayer = getUploadRoute(router);

    expect(routeLayer).toBeDefined();
    expect(routeLayer.route.methods.post).toBe(true);
    expect(routeLayer.route.stack).toHaveLength(2);
    expect(mockMulter.mock.calls[0][0].limits).toEqual({
      files: 1,
      fileSize: 2 * 1024 * 1024 * 1024,
    });
  });

  test('registers the YouTube account connection endpoints', () => {
    const router = loadRouter();
    const {
      connectYoutubeAccount,
      disconnectYoutubeAccount,
      getYoutubeAuthorizationUrl,
      getYoutubeConnectionStatus,
    } = require('../controllers/youtubeAutoPoster');
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

  test('uses the configured temporary directory and generated filename for disk storage', () => {
    const router = loadRouter();
    const storageOptions = mockMulter.diskStorage.mock.calls[0][0];
    const destination = jest.fn();
    const filename = jest.fn();

    storageOptions.destination({}, {}, destination);
    storageOptions.filename({}, {}, filename);

    expect(destination).toHaveBeenCalledWith(null, '/tmp/youtube-uploads');
    expect(filename).toHaveBeenCalledWith(null, 'youtube-fixed-uuid');
    expect(mockTmpdir).toHaveBeenCalled();
    expect(mockRandomUUID).toHaveBeenCalled();
    expect(getUploadRoute(router)).toBeDefined();
  });

  test.each([
    ['video/mp4', [null, true]],
    ['video/webm', [null, true]],
  ])('accepts %s video MIME types', (mimetype, expectedCallbackArguments) => {
    loadRouter();
    const [[{ fileFilter }]] = mockMulter.mock.calls;
    const callback = jest.fn();

    fileFilter({}, { mimetype }, callback);

    expect(callback).toHaveBeenCalledWith(...expectedCallbackArguments);
  });

  test.each([undefined, '', 'text/plain'])(
    'rejects missing or invalid MIME type %s',
    (mimetype) => {
      loadRouter();
      const [[{ fileFilter }]] = mockMulter.mock.calls;
      const callback = jest.fn();

      fileFilter({}, { mimetype }, callback);

      expect(callback).toHaveBeenCalledTimes(1);
      const [error] = callback.mock.calls[0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('video must be a supported video file');
      expect(error.statusCode).toBe(400);
    },
  );

  test('uses a valid YOUTUBE_MAX_UPLOAD_BYTES value', () => {
    loadRouter('987654321');

    expect(mockMulter.mock.calls[0][0].limits.fileSize).toBe(987654321);
  });

  test('delegates a parsed upload and removes its temporary file', async () => {
    const router = loadRouter();
    const controllerHandler = getUploadRoute(router).route.stack[1].handle;
    const req = {
      body: {
        metadata: JSON.stringify({ title: 'A video', categoryId: '22', madeForKids: false }),
      },
      file: {
        fieldname: 'video',
        mimetype: 'video/mp4',
        path: '/tmp/youtube-fixed-uuid',
      },
    };
    const res = makeResponse();
    const next = jest.fn();

    await controllerHandler(req, res, next);

    expect(mockUploadVideo).toHaveBeenCalledWith(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockUnlink).toHaveBeenCalledWith(req.file.path);
    expect(next).not.toHaveBeenCalled();
  });

  test('does not try to remove a missing temporary file path', async () => {
    const router = loadRouter();
    const controllerHandler = getUploadRoute(router).route.stack[1].handle;
    const req = { file: {} };

    await controllerHandler(req, makeResponse(), jest.fn());

    expect(mockUnlink).not.toHaveBeenCalled();
  });

  test('logs temporary-file cleanup failures without failing the upload', async () => {
    const cleanupError = new Error('permission denied');
    mockUnlink.mockRejectedValue(cleanupError);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const router = loadRouter();
    const controllerHandler = getUploadRoute(router).route.stack[1].handle;
    const req = { file: { path: '/tmp/youtube-fixed-uuid' } };
    const res = makeResponse();

    await controllerHandler(req, res, jest.fn());

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to remove temporary YouTube upload /tmp/youtube-fixed-uuid:',
      cleanupError.message,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    consoleError.mockRestore();
  });

  test('forwards uploadVideo errors to next and still cleans up', async () => {
    const uploadError = new Error('YouTube rejected the upload');
    mockUploadVideo.mockRejectedValue(uploadError);
    const router = loadRouter();
    const controllerHandler = getUploadRoute(router).route.stack[1].handle;
    const req = { file: { path: '/tmp/youtube-fixed-uuid' } };
    const next = jest.fn();

    await controllerHandler(req, makeResponse(), next);

    expect(next).toHaveBeenCalledWith(uploadError);
    expect(mockUnlink).toHaveBeenCalledWith(req.file.path);
  });

  describe('error middleware', () => {
    test('passes through when no error is provided', () => {
      const router = loadRouter();
      const errorHandler = getErrorHandler(router);
      const next = jest.fn();

      errorHandler(undefined, {}, makeResponse(), next);

      expect(next).toHaveBeenCalledWith();
    });

    test('returns 413 for Multer file-size errors', () => {
      const router = loadRouter('1234');
      const errorHandler = getErrorHandler(router);
      const response = makeResponse();

      errorHandler(new MockMulterError('LIMIT_FILE_SIZE'), {}, response, jest.fn());

      expect(response.status).toHaveBeenCalledWith(413);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'video must not exceed 1234 bytes',
      });
    });

    test('returns 400 for other Multer errors', () => {
      const router = loadRouter();
      const errorHandler = getErrorHandler(router);
      const response = makeResponse();
      const error = new MockMulterError('LIMIT_UNEXPECTED_FILE', 'unexpected video field');

      errorHandler(error, {}, response, jest.fn());

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'unexpected video field',
      });
    });

    test.each([
      [422, 'unprocessable upload', 422, 'unprocessable upload'],
      [undefined, 'failed upload', 500, 'failed upload'],
      [418, undefined, 418, 'Failed to receive YouTube upload'],
      [undefined, undefined, 500, 'Failed to receive YouTube upload'],
    ])(
      'returns the normal error status/message for statusCode=%s and message=%s',
      (statusCode, message, expectedStatus, expectedMessage) => {
        const router = loadRouter();
        const errorHandler = getErrorHandler(router);
        const response = makeResponse();
        const error = new Error(message);
        if (statusCode !== undefined) error.statusCode = statusCode;

        errorHandler(error, {}, response, jest.fn());

        expect(response.status).toHaveBeenCalledWith(expectedStatus);
        expect(response.json).toHaveBeenCalledWith({
          success: false,
          message: expectedMessage,
        });
      },
    );
  });
});
