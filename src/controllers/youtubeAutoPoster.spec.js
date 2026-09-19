jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(),
    },
    youtube: jest.fn(),
  },
}));

jest.mock('node:fs', () => ({
  createReadStream: jest.fn(() => ({ pathStream: true })),
}));

const { google } = require('googleapis');
const {
  connectYoutubeAccount,
  disconnectYoutubeAccount,
  getYoutubeAuthorizationUrl,
  getYoutubeConnectionStatus,
  uploadVideo,
  normalizeUploadMetadata,
  buildYoutubeRequestBody,
  videoFileSchema,
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

  test('rejects a video upload without a request body', async () => {
    const res = makeResponse();

    await uploadVideo({ file: makeVideo() }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'title is required' }),
    );
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

  test('normalizes JSON-like tags and optional YouTube metadata fields', () => {
    const metadata = normalizeUploadMetadata({
      title: 'A video',
      categoryId: 22,
      tags: '[" community ", " ", "education"]',
      madeForKids: true,
      containsSyntheticMedia: 'false',
      defaultLanguage: ' en ',
      defaultAudioLanguage: ' fr ',
      publishAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(metadata.tags).toEqual(['community', 'education']);
    expect(buildYoutubeRequestBody(metadata)).toEqual({
      snippet: {
        title: 'A video',
        description: '',
        categoryId: '22',
        tags: ['community', 'education'],
        defaultLanguage: 'en',
        defaultAudioLanguage: 'fr',
      },
      status: {
        privacyStatus: 'private',
        selfDeclaredMadeForKids: true,
        embeddable: true,
        license: 'youtube',
        publicStatsViewable: true,
        publishAt: metadata.publishAt,
        containsSyntheticMedia: false,
      },
    });
  });

  test('rejects malformed JSON-array tags and past scheduled uploads', () => {
    expect(() =>
      normalizeUploadMetadata({
        title: 'A video',
        categoryId: '22',
        tags: '[not valid json',
        madeForKids: false,
      }),
    ).toThrow(/tags must be a JSON array or comma-separated text/);

    expect(() =>
      normalizeUploadMetadata({
        title: 'A video',
        categoryId: '22',
        tags: 123,
        madeForKids: false,
      }),
    ).toThrow(/tags must be a JSON array or comma-separated text/);

    expect(() =>
      normalizeUploadMetadata({
        title: 'A video',
        categoryId: '22',
        madeForKids: false,
        publishAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).toThrow(/publishAt must be a valid future date/);

    expect(() =>
      normalizeUploadMetadata({
        title: 'A video',
        categoryId: '22',
        madeForKids: undefined,
      }),
    ).toThrow(/madeForKids is required/);

    expect(() =>
      normalizeUploadMetadata({
        title: 'A video',
        categoryId: '22',
        madeForKids: false,
        metadata: '[]',
      }),
    ).toThrow(/metadata must be valid JSON/);

    expect(
      normalizeUploadMetadata({
        metadata: {
          title: 'A video',
          categoryId: '22',
          madeForKids: false,
        },
        defaultLanguage: '',
        publishAt: '',
      }).defaultLanguage,
    ).toBeUndefined();

    expect(() => normalizeUploadMetadata()).toThrow(/title is required/);
  });

  test('rejects empty video content and files without content', () => {
    expect(() =>
      videoFileSchema.parse({
        mimetype: 'video/mp4',
        size: 0,
        path: '/tmp/video.mp4',
      }),
    ).toThrow(/video must not be empty/);

    expect(() => videoFileSchema.parse({ mimetype: 'video/mp4' })).toThrow(
      /video content is missing/,
    );
  });

  test('uses stream and path-backed video content', async () => {
    const stream = { on: jest.fn() };
    const streamRequest = {
      file: { ...makeVideo(), stream },
      body: { title: 'A video', categoryId: '22', madeForKids: false },
    };
    await uploadVideo(streamRequest, makeResponse());
    expect(insert.mock.calls[0][0].media.body).toBe(stream);

    jest.clearAllMocks();
    google.auth.OAuth2.mockImplementation(() => ({ setCredentials }));
    google.youtube.mockReturnValue({ videos: { insert }, channels: { list: listChannels } });
    insert.mockResolvedValue({ data: { id: 'path-video-id' } });
    await uploadVideo(
      {
        file: { mimetype: 'video/mp4', path: '/tmp/video.mp4', size: 10 },
        body: { title: 'A video', categoryId: '22', madeForKids: false },
      },
      makeResponse(),
    );
    expect(insert.mock.calls[0][0].media.body).toBeDefined();
  });

  test('reports missing OAuth configuration and supports missing authorization sessions', () => {
    delete process.env.YOUTUBE_CLIENT_ID;
    const missingConfigResponse = makeResponse();
    getYoutubeAuthorizationUrl({ session: {} }, missingConfigResponse);

    expect(missingConfigResponse.status).toHaveBeenCalledWith(500);
    expect(missingConfigResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'Missing YouTube OAuth configuration: YOUTUBE_CLIENT_ID',
    });

    const noSessionResponse = makeResponse();
    getYoutubeAuthorizationUrl({}, noSessionResponse);
    expect(noSessionResponse.status).toHaveBeenCalledWith(500);
    expect(noSessionResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'Session support is required to connect a YouTube account',
    });

    process.env.YOUTUBE_CLIENT_ID = 'client-id';
    google.auth.OAuth2.mockImplementation(() => {
      throw new Error();
    });
    const fallbackResponse = makeResponse();
    getYoutubeAuthorizationUrl({ session: {} }, fallbackResponse);
    expect(fallbackResponse.status).toHaveBeenCalledWith(500);
    expect(fallbackResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to start YouTube authorization',
    });
  });

  test('handles malformed connection requests and missing refresh tokens', async () => {
    const invalidResponse = makeResponse();
    await connectYoutubeAccount({ body: {}, session: {} }, invalidResponse);
    expect(invalidResponse.status).toHaveBeenCalledWith(400);
    expect(invalidResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'code is required' }),
    );

    getToken.mockResolvedValue({ tokens: { access_token: 'access-token' } });
    const noRefreshResponse = makeResponse();
    const req = {
      body: {
        code: 'authorization-code',
        state: 'valid-state',
        requestor: { requestorId: 'user-id' },
      },
      session: {
        youtubeOAuth: {
          state: 'valid-state',
          userId: 'user-id',
          expiresAt: Date.now() + 60_000,
        },
      },
    };
    await connectYoutubeAccount(req, noRefreshResponse);
    expect(noRefreshResponse.status).toHaveBeenCalledWith(400);
    expect(noRefreshResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'YouTube did not return a refresh token; please reconnect the account',
    });

    const missingBodyResponse = makeResponse();
    await connectYoutubeAccount({}, missingBodyResponse);
    expect(missingBodyResponse.status).toHaveBeenCalledWith(400);

    const invalidShapeResponse = makeResponse();
    await connectYoutubeAccount({ body: 'not-an-object' }, invalidShapeResponse);
    expect(invalidShapeResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field: 'request' })] }),
    );
  });

  test('forwards connection provider errors with a safe status', async () => {
    getToken.mockRejectedValue({ response: { status: 401 }, message: 'invalid grant' });
    const response = makeResponse();
    await connectYoutubeAccount(
      {
        body: {
          code: 'authorization-code',
          state: 'valid-state',
          requestor: { requestorId: 'user-id' },
        },
        session: {
          youtubeOAuth: {
            state: 'valid-state',
            userId: 'user-id',
            expiresAt: Date.now() + 60_000,
          },
        },
      },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ success: false, message: 'invalid grant' });

    getToken.mockRejectedValue({ statusCode: 600, errors: [{ message: 'bad provider response' }] });
    const fallbackResponse = makeResponse();
    await connectYoutubeAccount(
      {
        body: {
          code: 'authorization-code',
          state: 'valid-state',
          requestor: { requestorId: 'user-id' },
        },
        session: {
          youtubeOAuth: {
            state: 'valid-state',
            userId: 'user-id',
            expiresAt: Date.now() + 60_000,
          },
        },
      },
      fallbackResponse,
    );
    expect(fallbackResponse.status).toHaveBeenCalledWith(500);
    expect(fallbackResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'bad provider response',
    });

    getToken.mockResolvedValue({ tokens: { refresh_token: 'connected-refresh-token' } });
    const noExpiryResponse = makeResponse();
    await connectYoutubeAccount(
      {
        body: {
          code: 'authorization-code',
          state: 'valid-state',
          requestor: { requestorId: 'user-id' },
        },
        session: {
          youtubeOAuth: {
            state: 'valid-state',
            userId: 'user-id',
            expiresAt: Date.now() + 60_000,
          },
        },
      },
      noExpiryResponse,
    );
    expect(noExpiryResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    );
  });

  test('handles disconnected sessions and token revocation failures', async () => {
    const alreadyDisconnected = makeResponse();
    const session = { youtubeConnectedUserId: 'user-id', youtubeOAuth: { state: 'stale' } };
    await disconnectYoutubeAccount(
      { requestor: { requestorId: 'user-id' }, session },
      alreadyDisconnected,
    );
    expect(alreadyDisconnected.status).toHaveBeenCalledWith(200);
    expect(session.youtubeOAuth).toBeUndefined();

    revokeToken.mockRejectedValue({ response: { status: 429 }, message: 'rate limited' });
    const response = makeResponse();
    const connectedSession = {
      youtubeConnectedUserId: 'user-id',
      youtubeCredentials: { refresh_token: 'connected-refresh-token' },
      youtubeOAuth: { state: 'stale' },
    };
    await disconnectYoutubeAccount(
      { requestor: { requestorId: 'user-id' }, session: connectedSession },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      connected: false,
      message: 'rate limited',
    });
    expect(connectedSession.youtubeCredentials).toBeUndefined();

    const mismatchedSession = {
      youtubeConnectedUserId: 'other-user',
      youtubeCredentials: { refresh_token: 'other-refresh-token' },
    };
    const mismatchedResponse = makeResponse();
    await disconnectYoutubeAccount(
      { requestor: { requestorId: 'user-id' }, session: mismatchedSession },
      mismatchedResponse,
    );
    expect(revokeToken).toHaveBeenCalledTimes(1);

    const noSessionResponse = makeResponse();
    await disconnectYoutubeAccount({}, noSessionResponse);
    expect(noSessionResponse.status).toHaveBeenCalledWith(200);

    revokeToken.mockRejectedValue(new Error('Google unavailable'));
    const gatewayResponse = makeResponse();
    await disconnectYoutubeAccount(
      {
        requestor: { requestorId: 'user-id' },
        session: {
          youtubeConnectedUserId: 'user-id',
          youtubeCredentials: { refresh_token: 'connected-refresh-token' },
        },
      },
      gatewayResponse,
    );
    expect(gatewayResponse.status).toHaveBeenCalledWith(502);
  });

  test('returns an empty channel account when YouTube has no channels', async () => {
    listChannels.mockResolvedValue({ data: { items: [] } });
    const response = makeResponse();
    await getYoutubeConnectionStatus(
      {
        requestor: { requestorId: 'user-id' },
        session: {
          youtubeConnectedUserId: 'user-id',
          youtubeCredentials: { refresh_token: 'connected-refresh-token' },
        },
      },
      response,
    );
    expect(response.json).toHaveBeenCalledWith({ success: true, connected: true, account: null });

    listChannels.mockRejectedValue({ statusCode: 600, errors: [{ message: 'channel failure' }] });
    const errorResponse = makeResponse();
    await getYoutubeConnectionStatus(
      {
        requestor: { requestorId: 'user-id' },
        session: {
          youtubeConnectedUserId: 'user-id',
          youtubeCredentials: { refresh_token: 'connected-refresh-token' },
        },
      },
      errorResponse,
    );
    expect(errorResponse.status).toHaveBeenCalledWith(500);
    expect(errorResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'channel failure',
    });

    listChannels.mockResolvedValue({
      data: { items: [{ id: 'channel-without-details', snippet: {} }] },
    });
    const sparseResponse = makeResponse();
    await getYoutubeConnectionStatus(
      {
        requestor: { requestorId: 'user-id' },
        session: {
          youtubeConnectedUserId: 'user-id',
          youtubeCredentials: { refresh_token: 'connected-refresh-token' },
        },
      },
      sparseResponse,
    );
    expect(sparseResponse.json).toHaveBeenCalledWith({
      success: true,
      connected: true,
      account: {
        channelId: 'channel-without-details',
        channelName: null,
        thumbnail: null,
        customUrl: null,
      },
    });
  });

  test('lists video categories with optional filters and defaults', async () => {
    const videoCategories = jest.fn().mockResolvedValue({
      data: {
        items: [
          { id: '22', snippet: { title: 'People & Blogs', assignable: true } },
          { id: '24', snippet: {} },
        ],
      },
    });
    google.youtube.mockReturnValue({
      videos: { insert },
      channels: { list: listChannels },
      videoCategories: { list: videoCategories },
    });
    const response = makeResponse();
    await require('./youtubeAutoPoster').getYoutubeVideoCategories(
      {
        query: { regionCode: 'CA', hl: 'en' },
        requestor: { requestorId: 'user-id' },
      },
      response,
    );
    expect(videoCategories).toHaveBeenCalledWith({ part: ['snippet'], regionCode: 'CA', hl: 'en' });
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      categories: [
        { id: '22', title: 'People & Blogs', assignable: true },
        { id: '24', title: null, assignable: false },
      ],
    });
  });

  test('returns a safe error when categories cannot be fetched', async () => {
    const videoCategories = jest.fn().mockRejectedValue(new Error('categories unavailable'));
    google.youtube.mockReturnValue({ videoCategories: { list: videoCategories } });
    const response = makeResponse();
    await require('./youtubeAutoPoster').getYoutubeVideoCategories({}, response);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: 'categories unavailable',
    });

    google.youtube.mockReturnValue({
      videoCategories: { list: jest.fn().mockResolvedValue({}) },
    });
    const emptyResponse = makeResponse();
    await require('./youtubeAutoPoster').getYoutubeVideoCategories({}, emptyResponse);
    expect(emptyResponse.json).toHaveBeenCalledWith({ success: true, categories: [] });

    google.youtube.mockReturnValue({
      videoCategories: { list: jest.fn().mockRejectedValue({}) },
    });
    const fallbackResponse = makeResponse();
    await require('./youtubeAutoPoster').getYoutubeVideoCategories({}, fallbackResponse);
    expect(fallbackResponse.status).toHaveBeenCalledWith(500);
    expect(fallbackResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to fetch YouTube video categories',
    });

    google.youtube.mockReturnValue({
      videoCategories: { list: jest.fn().mockRejectedValue({ response: { status: 400 } }) },
    });
    const badRequestResponse = makeResponse();
    await require('./youtubeAutoPoster').getYoutubeVideoCategories({}, badRequestResponse);
    expect(badRequestResponse.status).toHaveBeenCalledWith(400);
  });
});
