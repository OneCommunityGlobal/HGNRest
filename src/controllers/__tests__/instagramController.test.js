jest.mock('../../models/instagramScheduledPost', () => ({
  find: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

jest.mock('../../models/instagramPostHistory', () => ({
  find: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../models/metaToken', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../services/instagramServices', () => ({
  publishInstagramPost: jest.fn(),
}));

jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const fs = require('fs');
const crypto = require('crypto');
const InstagramScheduledPost = require('../../models/instagramScheduledPost');
const InstagramPostHistory = require('../../models/instagramPostHistory');
const MetaToken = require('../../models/metaToken');
const { publishInstagramPost } = require('../../services/instagramServices');
const {
  createPost,
  schedulePost,
  getScheduledPosts,
  deleteScheduledPost,
  getHistory,
  retryScheduledPost,
} = require('../instagramController');

// ─── test utilities ─────────────────────────────────────────────────────────

function futureDate() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

// ─── Test helpers ──────────────────────────────────────────────────────────

const VALID_USER_ID = '507f1f77bcf86cd799439011';
const VALID_POST_ID = '507f1f77bcf86cd799439012';

const VALID_MEDIA_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// Mirrors what the global auth middleware actually puts on the request:
// req.body.requestor.requestorId. Pass requestorId: undefined to simulate
// an unauthenticated request (as if the middleware's allowlist/verify
// step never ran or failed).
function buildReq({ body = {}, params = {}, query = {}, requestorId = VALID_USER_ID } = {}) {
  return {
    body: {
      ...body,
      requestor: requestorId === undefined ? undefined : { requestorId },
    },
    params,
    query,
  };
}

function buildRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn();
  return res;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    INSTAGRAM_ACCOUNT_ID: 'ig-account-123',
    INSTAGRAM_MEDIA_BASE_URL: 'https://backend.example.com',
  };
  fs.mkdirSync.mockReturnValue(undefined);
  fs.writeFileSync.mockReturnValue(undefined);
  jest.spyOn(crypto, 'randomUUID').mockReturnValue('fixed-uuid');
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

// ─── createPost ─────────────────────────────────────────────────────────────

describe('createPost', () => {
  test('returns 401 when req.body.requestor is undefined', async () => {
    const req = buildReq();
    req.body.requestor = undefined;
    const res = buildRes();
    console.log('req', req);
    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ detail: 'Not authenticated' });
  });

  test('returns 401 when requestorId is not a valid ObjectId', async () => {
    const req = buildReq({ requestorId: 'not-an-object-id' });
    const res = buildRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 400 when caption is missing', async () => {
    const req = buildReq({ body: { media: { base64: VALID_MEDIA_BASE64 } } });
    const res = buildRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Caption is required.' });
  });

  test('returns 400 when caption is only whitespace', async () => {
    const req = buildReq({ body: { caption: '   ', media: { base64: VALID_MEDIA_BASE64 } } });
    const res = buildRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when media is missing', async () => {
    const req = buildReq({ body: { caption: 'Hello world' } });
    const res = buildRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Media is required.' });
  });

  test('returns 500 when Instagram token is missing or expired', async () => {
    MetaToken.findOne.mockResolvedValue(null);
    const req = buildReq({
      body: { caption: 'Hello world', media: { base64: VALID_MEDIA_BASE64 } },
    });
    const res = buildRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Instagram access token is missing or expired. Refresh required.',
    });
  });

  test('returns 500 when Instagram token is expired', async () => {
    MetaToken.findOne.mockResolvedValue({
      accessToken: 'expired-token',
      expiresAt: new Date(Date.now() - 1000),
    });
    const req = buildReq({
      body: { caption: 'Hello world', media: { base64: VALID_MEDIA_BASE64 } },
    });
    const res = buildRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('returns 500 when media base64 data is malformed', async () => {
    MetaToken.findOne.mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: new Date(Date.now() + 100000),
    });
    const req = buildReq({
      body: { caption: 'Hello world', media: { base64: 'not-a-real-data-url' } },
    });
    const res = buildRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid media data.' });
  });

  test('returns 500 when INSTAGRAM_MEDIA_BASE_URL is not configured', async () => {
    delete process.env.INSTAGRAM_MEDIA_BASE_URL;
    MetaToken.findOne.mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: new Date(Date.now() + 100000),
    });
    const req = buildReq({
      body: { caption: 'Hello world', media: { base64: VALID_MEDIA_BASE64 } },
    });
    const res = buildRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'INSTAGRAM_MEDIA_BASE_URL is not configured.' });
  });

  test('returns 500 with the Graph API error message when publishing fails', async () => {
    MetaToken.findOne.mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: new Date(Date.now() + 100000),
    });
    publishInstagramPost.mockRejectedValue({
      response: { data: { error: { message: 'Invalid OAuth access token.' } } },
    });
    const req = buildReq({
      body: { caption: 'Hello world', media: { base64: VALID_MEDIA_BASE64 } },
    });
    const res = buildRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid OAuth access token.' });
  });

  test('returns 500 with err.message when publishing fails without a Graph API response body', async () => {
    MetaToken.findOne.mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: new Date(Date.now() + 100000),
    });
    publishInstagramPost.mockRejectedValue(new Error('Network timeout'));
    const req = buildReq({
      body: { caption: 'Hello world', media: { base64: VALID_MEDIA_BASE64 } },
    });
    const res = buildRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Network timeout' });
  });

  test('publishes successfully, writes media to disk, records history, and returns 200', async () => {
    MetaToken.findOne.mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: new Date(Date.now() + 100000),
    });
    publishInstagramPost.mockResolvedValue({
      creationId: 'creation-1',
      instagramMediaId: 'media-1',
      permalink: 'https://instagram.com/p/abc123',
    });
    InstagramPostHistory.create.mockResolvedValue({ _id: 'history-1' });

    const req = buildReq({
      body: {
        caption: '  Hello world  ',
        media: { base64: VALID_MEDIA_BASE64 },
        altText: 'A photo',
      },
    });
    const res = buildRes();

    await createPost(req, res);

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('uploads'), {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('fixed-uuid.png'),
      expect.any(Buffer),
    );

    expect(publishInstagramPost).toHaveBeenCalledWith({
      instagramAccountId: 'ig-account-123',
      accessToken: 'valid-token',
      caption: 'Hello world',
      mediaUrl: 'https://backend.example.com/uploads/instagram/fixed-uuid.png',
      mediaType: 'IMAGE',
    });

    expect(InstagramPostHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: VALID_USER_ID,
        caption: 'Hello world',
        mediaType: 'IMAGE',
        instagramMediaId: 'media-1',
        permalink: 'https://instagram.com/p/abc123',
        status: 'published',
      }),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      creationId: 'creation-1',
      instagramMediaId: 'media-1',
      permalink: 'https://instagram.com/p/abc123',
    });
  });

  test('classifies video media correctly', async () => {
    MetaToken.findOne.mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: new Date(Date.now() + 100000),
    });
    publishInstagramPost.mockResolvedValue({
      creationId: 'creation-2',
      instagramMediaId: 'media-2',
      permalink: null,
    });
    InstagramPostHistory.create.mockResolvedValue({ _id: 'history-2' });

    const videoBase64 = 'data:video/mp4;base64,AAAA';
    const req = buildReq({ body: { caption: 'A clip', media: { base64: videoBase64 } } });
    const res = buildRes();

    await createPost(req, res);

    expect(publishInstagramPost).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: 'VIDEO' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─── schedulePost ───────────────────────────────────────────────────────────

describe('schedulePost', () => {
  test('returns 401 when req.body.requestor is undefined', async () => {
    const req = buildReq();
    req.body.requestor = undefined;
    const res = buildRes();

    await schedulePost(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 when requestorId is not a valid ObjectId', async () => {
    const req = buildReq({ requestorId: 'not-an-object-id' });
    const res = buildRes();

    await schedulePost(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 400 when caption is missing', async () => {
    const req = buildReq({
      body: { media: { base64: VALID_MEDIA_BASE64 }, scheduledTime: futureDate() },
    });
    const res = buildRes();

    await schedulePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Caption is required.' });
  });

  test('returns 400 when media is missing', async () => {
    const req = buildReq({ body: { caption: 'Hello', scheduledTime: futureDate() } });
    const res = buildRes();

    await schedulePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Media is required.' });
  });

  test('returns 400 when scheduledTime is missing', async () => {
    const req = buildReq({ body: { caption: 'Hello', media: { base64: VALID_MEDIA_BASE64 } } });
    const res = buildRes();

    await schedulePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Scheduled time is required.' });
  });

  test('returns 400 when scheduledTime is not a valid date', async () => {
    const req = buildReq({
      body: {
        caption: 'Hello',
        media: { base64: VALID_MEDIA_BASE64 },
        scheduledTime: 'not-a-date',
      },
    });
    const res = buildRes();

    await schedulePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Scheduled time must be in the future.' });
  });

  test('returns 400 when scheduledTime is in the past', async () => {
    const req = buildReq({
      body: {
        caption: 'Hello',
        media: { base64: VALID_MEDIA_BASE64 },
        scheduledTime: new Date(Date.now() - 100000).toISOString(),
      },
    });
    const res = buildRes();

    await schedulePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Scheduled time must be in the future.' });
  });

  test('returns 500 when media is malformed', async () => {
    const req = buildReq({
      body: {
        caption: 'Hello',
        media: { base64: 'garbage' },
        scheduledTime: futureDate(),
      },
    });
    const res = buildRes();

    await schedulePost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid media data.' });
  });

  test('creates a scheduled post and returns 201 on success', async () => {
    const scheduledTime = futureDate();
    InstagramScheduledPost.create.mockResolvedValue({
      _id: VALID_POST_ID,
      userId: VALID_USER_ID,
      caption: 'Hello',
      status: 'scheduled',
    });

    const req = buildReq({
      body: {
        caption: '  Hello  ',
        media: { base64: VALID_MEDIA_BASE64 },
        altText: 'desc',
        scheduledTime,
      },
    });
    const res = buildRes();

    await schedulePost(req, res);

    expect(InstagramScheduledPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: VALID_USER_ID,
        caption: 'Hello',
        mediaType: 'IMAGE',
        mediaAltText: 'desc',
        status: 'scheduled',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Post scheduled.' }));
  });

  test('defaults mediaAltText to null when altText is not provided', async () => {
    InstagramScheduledPost.create.mockResolvedValue({ _id: VALID_POST_ID });
    const req = buildReq({
      body: {
        caption: 'Hello',
        media: { base64: VALID_MEDIA_BASE64 },
        scheduledTime: futureDate(),
      },
    });
    const res = buildRes();

    await schedulePost(req, res);

    expect(InstagramScheduledPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ mediaAltText: null }),
    );
  });

  test('returns 500 when InstagramScheduledPost.create throws', async () => {
    InstagramScheduledPost.create.mockRejectedValue(new Error('DB write failed'));
    const req = buildReq({
      body: {
        caption: 'Hello',
        media: { base64: VALID_MEDIA_BASE64 },
        scheduledTime: futureDate(),
      },
    });
    const res = buildRes();

    await schedulePost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'DB write failed' });
  });
});

// ─── getScheduledPosts ──────────────────────────────────────────────────────

describe('getScheduledPosts', () => {
  test('returns 401 when req.body.requestor is undefined', async () => {
    const req = buildReq();
    req.body.requestor = undefined;
    const res = buildRes();

    await getScheduledPosts(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 when requestorId is not a valid ObjectId', async () => {
    const req = buildReq({ requestorId: 'not-an-object-id' });
    const res = buildRes();

    await getScheduledPosts(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('queries with the correct filter and returns 200', async () => {
    const lean = jest.fn().mockResolvedValue([{ _id: VALID_POST_ID, status: 'scheduled' }]);
    const sort = jest.fn().mockReturnValue({ lean });
    InstagramScheduledPost.find.mockReturnValue({ sort });

    const req = buildReq();
    const res = buildRes();

    await getScheduledPosts(req, res);

    expect(InstagramScheduledPost.find).toHaveBeenCalledWith({
      userId: VALID_USER_ID,
      status: { $in: ['scheduled', 'publishing', 'failed'] },
    });
    expect(sort).toHaveBeenCalledWith({ scheduledTime: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ _id: VALID_POST_ID, status: 'scheduled' }]);
  });

  test('returns 500 when the query throws', async () => {
    InstagramScheduledPost.find.mockImplementation(() => {
      throw new Error('DB unavailable');
    });
    const req = buildReq();
    const res = buildRes();

    await getScheduledPosts(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'DB unavailable' });
  });
});

// ─── deleteScheduledPost ────────────────────────────────────────────────────

describe('deleteScheduledPost', () => {
  test('returns 401 when req.body.requestor is undefined', async () => {
    const req = buildReq();
    req.body.requestor = undefined;
    req.body.params = { id: VALID_POST_ID };
    const res = buildRes();

    await deleteScheduledPost(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 when requestorId is not a valid ObjectId', async () => {
    const req = buildReq({ requestorId: 'not-an-object-id', params: { id: VALID_POST_ID } });
    const res = buildRes();

    await deleteScheduledPost(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 404 when the post does not exist or belongs to another user', async () => {
    InstagramScheduledPost.findOneAndDelete.mockResolvedValue(null);
    const req = buildReq({ params: { id: VALID_POST_ID } });
    const res = buildRes();

    await deleteScheduledPost(req, res);

    expect(InstagramScheduledPost.findOneAndDelete).toHaveBeenCalledWith({
      _id: VALID_POST_ID,
      userId: VALID_USER_ID,
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Scheduled post not found.' });
  });

  test('returns 200 when the post is deleted', async () => {
    InstagramScheduledPost.findOneAndDelete.mockResolvedValue({ _id: VALID_POST_ID });
    const req = buildReq({ params: { id: VALID_POST_ID } });
    const res = buildRes();

    await deleteScheduledPost(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Deleted.' });
  });

  test('returns 500 when the query throws', async () => {
    InstagramScheduledPost.findOneAndDelete.mockRejectedValue(new Error('DB error'));
    const req = buildReq({ params: { id: VALID_POST_ID } });
    const res = buildRes();

    await deleteScheduledPost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'DB error' });
  });
});

// ─── getHistory ─────────────────────────────────────────────────────────────

describe('getHistory', () => {
  test('returns 401 when req.body.requestor is undefined', async () => {
    const req = buildReq();
    req.body.requestor = undefined;
    const res = buildRes();

    await getHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 when requestorId is not a valid ObjectId', async () => {
    const req = buildReq({ requestorId: 'not-an-object-id' });
    const res = buildRes();

    await getHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('defaults to a limit of 20 when none is provided', async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const limitFn = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit: limitFn });
    InstagramPostHistory.find.mockReturnValue({ sort });

    const req = buildReq();
    const res = buildRes();

    await getHistory(req, res);

    expect(InstagramPostHistory.find).toHaveBeenCalledWith({ userId: VALID_USER_ID });
    expect(sort).toHaveBeenCalledWith({ postedAt: -1 });
    expect(limitFn).toHaveBeenCalledWith(20);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('respects a custom limit under the cap', async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const limitFn = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit: limitFn });
    InstagramPostHistory.find.mockReturnValue({ sort });

    const req = buildReq({ query: { limit: '5' } });
    const res = buildRes();

    await getHistory(req, res);

    expect(limitFn).toHaveBeenCalledWith(5);
  });

  test('caps the limit at 100 when a larger value is requested', async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const limitFn = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit: limitFn });
    InstagramPostHistory.find.mockReturnValue({ sort });

    const req = buildReq({ query: { limit: '500' } });
    const res = buildRes();

    await getHistory(req, res);

    expect(limitFn).toHaveBeenCalledWith(100);
  });

  test('returns 500 when the query throws', async () => {
    InstagramPostHistory.find.mockImplementation(() => {
      throw new Error('DB unavailable');
    });
    const req = buildReq();
    const res = buildRes();

    await getHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'DB unavailable' });
  });
});

// ─── retryScheduledPost ─────────────────────────────────────────────────────

describe('retryScheduledPost', () => {
  test('returns 401 when req.body.requestor is undefined', async () => {
    const req = buildReq();
    req.body.requestor = undefined;
    req.body.params = { id: VALID_POST_ID };
    const res = buildRes();

    await retryScheduledPost(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 when requestorId is not a valid ObjectId', async () => {
    const req = buildReq({ requestorId: 'not-an-object-id', params: { id: VALID_POST_ID } });
    const res = buildRes();

    await retryScheduledPost(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 404 when the post does not exist or belongs to another user', async () => {
    InstagramScheduledPost.findOne.mockResolvedValue(null);
    const req = buildReq({ params: { id: VALID_POST_ID } });
    const res = buildRes();

    await retryScheduledPost(req, res);

    expect(InstagramScheduledPost.findOne).toHaveBeenCalledWith({
      _id: VALID_POST_ID,
      userId: VALID_USER_ID,
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Scheduled post not found.' });
  });

  test('resets status to scheduled, clears lastError, saves, and returns 200', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const post = { status: 'failed', lastError: 'IG container error', save };
    InstagramScheduledPost.findOne.mockResolvedValue(post);

    const req = buildReq({ params: { id: VALID_POST_ID } });
    const res = buildRes();

    await retryScheduledPost(req, res);

    expect(post.status).toBe('scheduled');
    expect(post.lastError).toBeNull();
    expect(save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Post re-queued.', post });
  });

  test('returns 500 when save() throws', async () => {
    const save = jest.fn().mockRejectedValue(new Error('DB write failed'));
    InstagramScheduledPost.findOne.mockResolvedValue({ status: 'failed', save });

    const req = buildReq({ params: { id: VALID_POST_ID } });
    const res = buildRes();

    await retryScheduledPost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'DB write failed' });
  });
});
