// Mock googleapis completely inside the factory to avoid hoisting/undefined issues
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest
          .fn()
          .mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1'),
        getToken: jest.fn().mockResolvedValue({
          tokens: { refresh_token: 'mock-refresh-token', expiry_date: 123456789 },
        }),
        setCredentials: jest.fn(),
      })),
    },
    youtube: jest.fn().mockReturnValue({
      channels: {
        list: jest.fn().mockResolvedValue({
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
        }),
      },
      videos: {
        insert: jest.fn().mockResolvedValue({
          data: {
            id: 'video-123',
            snippet: { title: 'Test Video' },
            status: { privacyStatus: 'private' },
          },
        }),
      },
    }),
  },
}));

const {
  getYoutubeAuthorizationUrl,
  connectYoutubeAccount,
  getYoutubeConnectionStatus,
  uploadVideo,
  youtubeMetadataSchema,
  videoFileSchema,
} = require('../youtubeAutoPoster');

describe('youtubeAutoPoster Controller Tests', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
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
    it('should return 400 if validation or state check fails', async () => {
      req.body = { code: 'auth-code', state: 'wrong-state' };
      await connectYoutubeAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should connect account successfully with valid code and state', async () => {
      req.body = { code: 'auth-code', state: 'test-state-crypto' };
      await connectYoutubeAccount(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, connected: true }),
      );
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

    it('should return 400 if video file is missing or invalid', async () => {
      req.file = { mimetype: 'image/jpeg', size: 0 };
      await uploadVideo(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
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
