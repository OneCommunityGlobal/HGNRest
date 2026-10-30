// Mock googleapis completely inside the factory to avoid hoisting/undefined issues
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest
          .fn()
          .mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1'),
        getToken: jest.fn().mockImplementation(async (code) => {
          if (code === 'no-refresh-code') {
            return { tokens: {} };
          }
          return { tokens: { refresh_token: 'mock-refresh-token', expiry_date: 123456789 } };
        }),
        setCredentials: jest.fn(),
      })),
    },
    youtube: jest.fn().mockImplementation(() => ({
      channels: {
        list: jest.fn().mockImplementation(async () => {
          if (global.mockChannelError) throw new Error('API Error');
          return {
            data: {
              items: [
                {
                  id: 'channel-123',
                  snippet: {
                    title: 'Test Channel',
                    thumbnails: { default: { url: 'http://example.com/thumb.jpg' } },
                    customUrl: '@testchannel',
                  },
                },
              ],
            },
          };
        }),
      },
      videoCategories: {
        list: jest.fn().mockResolvedValue({
          data: {
            items: [
              { id: '22', snippet: { title: 'People & Blogs', assignable: true } },
              { id: '29', snippet: { title: 'Hidden', assignable: false } },
            ],
          },
        }),
      },
      videos: {
        insert: jest.fn().mockImplementation(async () => {
          if (global.mockNoVideoId) {
            return { data: {} };
          }
          if (global.mockVideoError) {
            throw new Error('Upload Failed');
          }
          return {
            data: {
              id: 'video-123',
              snippet: { title: 'Test Video' },
              status: { privacyStatus: 'private' },
            },
          };
        }),
      },
    })),
  },
}));

const {
  getYoutubeAuthorizationUrl,
  connectYoutubeAccount,
  disconnectYoutubeAccount,
  getYoutubeCategories,
  getYoutubeConnectionStatus,
  uploadVideo,
  youtubeMetadataSchema,
  videoFileSchema,
  normalizeUploadMetadata,
} = require('../youtubeAutoPoster');

describe('youtubeAutoPoster Controller Comprehensive Tests', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    global.mockChannelError = false;
    global.mockNoVideoId = false;
    global.mockVideoError = false;
    process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
    process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
    process.env.YOUTUBE_REDIRECT_URI = 'http://localhost/callback';

    req = {
      session: {
        youtubeOAuth: {
          state: 'test-state-crypto',
          userId: 'user-1',
          expiresAt: Date.now() + 600000,
        },
        youtubeCredentials: { refresh_token: 'mock-refresh-token' },
        youtubeConnectedUserId: 'user-1',
      },
      requestor: { requestorId: 'user-1' },
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
  });

  describe('getYoutubeAuthorizationUrl', () => {
    it('should return 500 if session is missing', () => {
      req.session = undefined;
      getYoutubeAuthorizationUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should generate auth url successfully when session exists', () => {
      getYoutubeAuthorizationUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, authUrl: expect.any(String) }),
      );
    });
  });

  describe('connectYoutubeAccount', () => {
    const errorUrl = 'http://localhost:5173/announcements/youtube?youtube=error';

    beforeEach(() => {
      delete process.env.FRONTEND_URL;
      req.query = { code: 'auth-code', state: 'test-state-crypto' };
    });

    it('should redirect with error if pendingOAuth is missing', async () => {
      req.session.youtubeOAuth = undefined;
      await connectYoutubeAccount(req, res);
      expect(res.redirect).toHaveBeenCalledWith(errorUrl);
    });

    it('should redirect with error if state is expired', async () => {
      req.session.youtubeOAuth.expiresAt = Date.now() - 1000;
      await connectYoutubeAccount(req, res);
      expect(res.redirect).toHaveBeenCalledWith(errorUrl);
    });

    it('should redirect with error if state does not match', async () => {
      req.query.state = 'other-state-crypto';
      await connectYoutubeAccount(req, res);
      expect(res.redirect).toHaveBeenCalledWith(errorUrl);
    });

    it('should redirect with error if the user denied access on Google', async () => {
      req.query = { error: 'access_denied', state: 'test-state-crypto' };
      await connectYoutubeAccount(req, res);
      expect(res.redirect).toHaveBeenCalledWith(errorUrl);
    });

    it('should redirect with error if tokens do not include refresh_token', async () => {
      req.query.code = 'no-refresh-code';
      await connectYoutubeAccount(req, res);
      expect(res.redirect).toHaveBeenCalledWith(errorUrl);
    });

    it('should redirect with error when code is missing', async () => {
      req.query = { state: 'test-state-crypto' };
      await connectYoutubeAccount(req, res);
      expect(res.redirect).toHaveBeenCalledWith(errorUrl);
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should store credentials and redirect to the frontend on success', async () => {
      req.session.youtubeCredentials = undefined;
      await connectYoutubeAccount(req, res);
      expect(req.session.youtubeCredentials.refresh_token).toBe('mock-refresh-token');
      expect(req.session.youtubeConnectedUserId).toBe('user-1');
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/announcements/youtube?youtube=connected',
      );
    });
  });

  describe('disconnectYoutubeAccount', () => {
    it('should clear YouTube credentials from the session', () => {
      disconnectYoutubeAccount(req, res);
      expect(req.session.youtubeCredentials).toBeUndefined();
      expect(req.session.youtubeConnectedUserId).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, connected: false });
    });
  });

  describe('getYoutubeCategories', () => {
    it('should return assignable categories', async () => {
      req.query = {};
      await getYoutubeCategories(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        categories: [{ id: '22', title: 'People & Blogs' }],
      });
    });

    it('should return an error when no account is connected', async () => {
      req.query = {};
      req.session.youtubeCredentials = undefined;
      await getYoutubeCategories(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getYoutubeConnectionStatus', () => {
    it('should return connected: false if credentials do not exist', async () => {
      req.session.youtubeCredentials = null;
      await getYoutubeConnectionStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, connected: false });
    });

    it('should return channel info when connected', async () => {
      await getYoutubeConnectionStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          connected: true,
          account: expect.any(Object),
        }),
      );
    });

    it('should handle error when fetching channel list fails', async () => {
      global.mockChannelError = true;
      await getYoutubeConnectionStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('uploadVideo', () => {
    it('should upload video successfully with valid file and metadata', async () => {
      req.file = {
        mimetype: 'video/mp4',
        size: 1024,
        buffer: Buffer.from('mock-video-content'),
      };
      req.body = {
        title: 'Test Video',
        categoryId: '22',
        madeForKids: 'false',
      };

      await uploadVideo(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          video: expect.objectContaining({ id: 'video-123' }),
        }),
      );
    });

    it('should handle video upload when videoId is missing (502 error)', async () => {
      req.file = {
        mimetype: 'video/mp4',
        size: 1024,
        buffer: Buffer.from('mock-video-content'),
      };
      req.body = {
        title: 'Test Video',
        categoryId: '22',
        madeForKids: 'false',
      };
      global.mockNoVideoId = true;
      await uploadVideo(req, res);
      expect(res.status).toHaveBeenCalledWith(502);
    });

    it('should handle general exception during video upload', async () => {
      req.file = {
        mimetype: 'video/mp4',
        size: 1024,
        buffer: Buffer.from('mock-video-content'),
      };
      req.body = {
        title: 'Test Video',
        categoryId: '22',
        madeForKids: 'false',
      };
      global.mockVideoError = true;
      await uploadVideo(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should return 400 if video file is missing or invalid', async () => {
      req.file = { mimetype: 'image/jpeg', size: 0 };
      await uploadVideo(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle metadata json string parsing error', async () => {
      req.file = {
        mimetype: 'video/mp4',
        size: 1024,
        buffer: Buffer.from('mock-video-content'),
      };
      req.body = {
        metadata: 'invalid-json-string',
      };
      await uploadVideo(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should parse valid metadata JSON string correctly', () => {
      const jsonString = JSON.stringify({
        title: 'JSON Title',
        categoryId: '22',
        madeForKids: false,
      });
      const result = normalizeUploadMetadata({ metadata: jsonString });
      expect(result.title).toBe('JSON Title');
    });
  });

  describe('Schemas and Validators', () => {
    it('should validate metadata schema correctly', () => {
      const validMetadata = {
        title: 'My Video',
        categoryId: '22',
        madeForKids: false,
      };
      const parsed = youtubeMetadataSchema.safeParse(validMetadata);
      expect(parsed.success).toBe(true);
    });

    it('should fail metadata validation for missing title', () => {
      const invalidMetadata = {
        categoryId: '22',
      };
      const parsed = youtubeMetadataSchema.safeParse(invalidMetadata);
      expect(parsed.success).toBe(false);
    });

    it('should validate video file schema correctly', () => {
      const validFile = {
        mimetype: 'video/mp4',
        size: 500,
        buffer: Buffer.from('data'),
      };
      expect(() => videoFileSchema.parse(validFile)).not.toThrow();
    });
  });
});
