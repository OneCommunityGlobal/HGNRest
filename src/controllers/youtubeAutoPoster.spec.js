jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(),
    },
    youtube: jest.fn(),
  },
}));

const { google } = require('googleapis');
const {
  connectYoutubeAccount,
  disconnectYoutubeAccount,
  getYoutubeAuthorizationUrl,
  getYoutubeConnectionStatus,
  uploadVideo,
} = require('./youtubeAutoPoster');

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const makeVideo = () => ({
  buffer: Buffer.from('video-bytes'),
  mimetype: 'video/mp4',
  originalname: 'example.mp4',
  size: 11,
});

describe('youtubeAutoPoster', () => {
  const originalEnvironment = { ...process.env };
  const insert = jest.fn();
  const listChannels = jest.fn();
  const setCredentials = jest.fn();
  const generateAuthUrl = jest.fn();
  const getToken = jest.fn();
  const revokeToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.YOUTUBE_CLIENT_ID = 'client-id';
    process.env.YOUTUBE_CLIENT_SECRET = 'client-secret';
    process.env.YOUTUBE_REDIRECT_URI = 'https://example.com/oauth/callback';
    process.env.YOUTUBE_REFRESH_TOKEN = 'refresh-token';

    google.auth.OAuth2.mockImplementation(() => ({
      generateAuthUrl,
      getToken,
      revokeToken,
      setCredentials,
    }));
    generateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?state=state');
    getToken.mockResolvedValue({
      tokens: {
        access_token: 'access-token',
        refresh_token: 'connected-refresh-token',
        expiry_date: 123456789,
      },
    });
    revokeToken.mockResolvedValue({ data: {} });
    google.youtube.mockReturnValue({
      videos: { insert },
      channels: { list: listChannels },
    });
    listChannels.mockResolvedValue({
      data: {
        items: [
          {
            id: 'youtube-channel-id',
            snippet: {
              title: 'One Community Global',
              thumbnails: {
                default: { url: 'https://example.com/channel-thumbnail.jpg' },
              },
            },
          },
        ],
      },
    });
    insert.mockResolvedValue({
      data: {
        id: 'youtube-video-id',
        snippet: { title: 'A video' },
        status: { privacyStatus: 'unlisted' },
      },
    });
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  test('uploads a video supplied with a JSON metadata field', async () => {
    const req = {
      file: makeVideo(),
      body: {
        metadata: JSON.stringify({
          title: 'A video',
          description: 'A description',
          tags: ['community', 'sustainability'],
          categoryId: '29',
          privacyStatus: 'unlisted',
          madeForKids: false,
        }),
      },
    };
    const res = makeResponse();

    await uploadVideo(req, res);

    expect(google.auth.OAuth2).toHaveBeenCalledWith(
      'client-id',
      'client-secret',
      'https://example.com/oauth/callback',
    );
    expect(setCredentials).toHaveBeenCalledWith({ refresh_token: 'refresh-token' });
    expect(google.youtube).toHaveBeenCalledWith({
      version: 'v3',
      auth: expect.any(Object),
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        part: ['snippet', 'status'],
        notifySubscribers: false,
        requestBody: {
          snippet: {
            title: 'A video',
            description: 'A description',
            categoryId: '29',
            tags: ['community', 'sustainability'],
          },
          status: expect.objectContaining({
            privacyStatus: 'unlisted',
            selfDeclaredMadeForKids: false,
          }),
        },
        media: expect.objectContaining({ mimeType: 'video/mp4' }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        video: expect.objectContaining({ id: 'youtube-video-id' }),
      }),
    );
  });

  test('creates an authorization URL and stores state in the session', () => {
    const req = {
      body: { requestor: { requestorId: 'user-id' } },
      session: {},
    };
    const res = makeResponse();

    getYoutubeAuthorizationUrl(req, res);

    expect(req.session.youtubeOAuth).toEqual({
      state: expect.any(String),
      userId: 'user-id',
      expiresAt: expect.any(Number),
    });
    expect(generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube.readonly',
        ],
        state: req.session.youtubeOAuth.state,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      authUrl: expect.stringContaining('accounts.google.com'),
    });
  });

  test('exchanges an authorization code and stores credentials in the session', async () => {
    const state = 'valid-oauth-state';
    const req = {
      body: {
        code: 'authorization-code',
        state,
        requestor: { requestorId: 'user-id' },
      },
      session: {
        youtubeOAuth: {
          state,
          userId: 'user-id',
          expiresAt: Date.now() + 60_000,
        },
      },
    };
    const res = makeResponse();

    await connectYoutubeAccount(req, res);

    expect(getToken).toHaveBeenCalledWith('authorization-code');
    expect(req.session.youtubeOAuth).toBeUndefined();
    expect(req.session.youtubeCredentials).toEqual(
      expect.objectContaining({ refresh_token: 'connected-refresh-token' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'YouTube account connected successfully',
      connected: true,
      expiresAt: 123456789,
    });
  });

  test('reports the YouTube channel connected by the authenticated user', async () => {
    const req = {
      requestor: { requestorId: 'user-id' },
      session: {
        youtubeConnectedUserId: 'user-id',
        youtubeCredentials: { refresh_token: 'connected-refresh-token' },
      },
    };
    const res = makeResponse();

    await getYoutubeConnectionStatus(req, res);

    expect(listChannels).toHaveBeenCalledWith({ part: ['snippet'], mine: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      connected: true,
      account: {
        channelId: 'youtube-channel-id',
        channelName: 'One Community Global',
        thumbnail: 'https://example.com/channel-thumbnail.jpg',
        customUrl: null,
      },
    });
  });

  test('revokes and clears the connected YouTube account', async () => {
    const req = {
      requestor: { requestorId: 'user-id' },
      session: {
        youtubeConnectedUserId: 'user-id',
        youtubeCredentials: { refresh_token: 'connected-refresh-token' },
        otherSessionValue: 'preserved',
      },
    };
    const res = makeResponse();

    await disconnectYoutubeAccount(req, res);

    expect(revokeToken).toHaveBeenCalledWith('connected-refresh-token');
    expect(req.session.youtubeCredentials).toBeUndefined();
    expect(req.session.youtubeConnectedUserId).toBeUndefined();
    expect(req.session.otherSessionValue).toBe('preserved');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      connected: false,
      message: 'YouTube account disconnected successfully',
    });
  });

  test('does not report another session user YouTube connection as connected', async () => {
    const req = {
      requestor: { requestorId: 'current-user-id' },
      session: {
        youtubeConnectedUserId: 'different-user-id',
        youtubeCredentials: { refresh_token: 'connected-refresh-token' },
      },
    };
    const res = makeResponse();

    await getYoutubeConnectionStatus(req, res);

    expect(listChannels).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, connected: false });
  });

  test('returns an upstream error when the connected channel cannot be retrieved', async () => {
    listChannels.mockRejectedValue({
      response: {
        status: 403,
        data: { error: { message: 'YouTube channel access was not granted' } },
      },
    });
    const req = {
      requestor: { requestorId: 'user-id' },
      session: {
        youtubeConnectedUserId: 'user-id',
        youtubeCredentials: { refresh_token: 'connected-refresh-token' },
      },
    };
    const res = makeResponse();

    await getYoutubeConnectionStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'YouTube channel access was not granted',
    });
  });

  test('rejects an invalid OAuth state without exchanging the code', async () => {
    const req = {
      body: {
        code: 'authorization-code',
        state: 'invalid-state',
        requestor: { requestorId: 'user-id' },
      },
      session: {
        youtubeOAuth: {
          state: 'expected-state',
          userId: 'user-id',
          expiresAt: Date.now() + 60_000,
        },
      },
    };
    const res = makeResponse();

    await connectYoutubeAccount(req, res);

    expect(getToken).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'YouTube authorization state is invalid or expired',
    });
  });

  test('uploads with credentials from a connected account session', async () => {
    const req = {
      file: makeVideo(),
      body: { title: 'A video', categoryId: '22', madeForKids: false },
      session: {
        youtubeCredentials: {
          access_token: 'session-access-token',
          refresh_token: 'session-refresh-token',
        },
        youtubeConnectedUserId: 'user-id',
      },
      requestor: { requestorId: 'user-id' },
    };
    const res = makeResponse();

    await uploadVideo(req, res);

    expect(setCredentials).toHaveBeenCalledWith(req.session.youtubeCredentials);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('accepts individual multipart fields and normalizes tags and booleans', async () => {
    const req = {
      file: makeVideo(),
      body: {
        title: 'A video',
        categoryId: '22',
        tags: 'community, education',
        privacyStatus: 'private',
        madeForKids: 'false',
        embeddable: 'true',
      },
    };
    const res = makeResponse();

    await uploadVideo(req, res);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          snippet: expect.objectContaining({ tags: ['community', 'education'] }),
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('rejects a request without a video', async () => {
    const res = makeResponse();

    await uploadVideo(
      {
        body: { title: 'A video', categoryId: '22', madeForKids: false },
      },
      res,
    );

    expect(insert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'video is required',
      errors: [{ field: 'video', message: 'video is required' }],
    });
  });

  test('rejects invalid JSON metadata', async () => {
    const res = makeResponse();

    await uploadVideo({ file: makeVideo(), body: { metadata: '{invalid' } }, res);

    expect(insert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'metadata must be valid JSON',
      errors: [{ field: 'metadata', message: 'metadata must be valid JSON' }],
    });
  });

  test('returns a field-level Zod error for an invalid multipart boolean', async () => {
    const res = makeResponse();

    await uploadVideo(
      {
        file: makeVideo(),
        body: {
          title: 'A video',
          categoryId: '22',
          madeForKids: 'not-a-boolean',
        },
      },
      res,
    );

    expect(insert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'madeForKids must be true or false',
      errors: [{ field: 'madeForKids', message: 'madeForKids must be true or false' }],
    });
  });

  test('returns a field-level Zod error for a non-video upload', async () => {
    const res = makeResponse();

    await uploadVideo(
      {
        file: { ...makeVideo(), mimetype: 'image/png' },
        body: { title: 'A video', categoryId: '22', madeForKids: false },
      },
      res,
    );

    expect(insert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'video must be a supported video file',
      errors: [{ field: 'video', message: 'video must be a supported video file' }],
    });
  });

  test('requires private visibility for a scheduled publication', async () => {
    const res = makeResponse();

    await uploadVideo(
      {
        file: makeVideo(),
        body: {
          title: 'A video',
          categoryId: '22',
          privacyStatus: 'public',
          madeForKids: false,
          publishAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
      res,
    );

    expect(insert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'privacyStatus must be private when publishAt is provided',
      errors: [
        {
          field: 'privacyStatus',
          message: 'privacyStatus must be private when publishAt is provided',
        },
      ],
    });
  });

  test('reports missing OAuth configuration without calling YouTube', async () => {
    delete process.env.YOUTUBE_REFRESH_TOKEN;
    const res = makeResponse();

    await uploadVideo(
      {
        file: makeVideo(),
        body: { title: 'A video', categoryId: '22', madeForKids: false },
      },
      res,
    );

    expect(insert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Missing YouTube OAuth configuration: YOUTUBE_REFRESH_TOKEN',
    });
  });

  test('returns an upstream API error to the caller', async () => {
    insert.mockRejectedValue({
      response: {
        status: 403,
        data: { error: { message: 'YouTube upload quota exceeded' } },
      },
    });
    const res = makeResponse();

    await uploadVideo(
      {
        file: makeVideo(),
        body: { title: 'A video', categoryId: '22', madeForKids: false },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'YouTube upload quota exceeded',
    });
  });

  test('rejects an upload response that has no video ID', async () => {
    insert.mockResolvedValue({ data: {} });
    const res = makeResponse();

    await uploadVideo(
      {
        file: makeVideo(),
        body: { title: 'A video', categoryId: '22', madeForKids: false },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'YouTube did not return a video ID',
    });
  });
});
