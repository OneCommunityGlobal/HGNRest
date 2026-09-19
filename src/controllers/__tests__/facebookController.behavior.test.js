jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('../../models/facebookConnections', () => ({
  getActiveConnection: jest.fn(),
}));

jest.mock('../../models/scheduledFacebookPost', () => {
  const MockScheduledFacebookPost = jest.fn();
  MockScheduledFacebookPost.find = jest.fn();
  MockScheduledFacebookPost.countDocuments = jest.fn();
  MockScheduledFacebookPost.findById = jest.fn();
  MockScheduledFacebookPost.findByIdAndDelete = jest.fn();
  return MockScheduledFacebookPost;
});

jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const axios = require('axios');
const FacebookConnection = require('../../models/facebookConnections');
const ScheduledFacebookPost = require('../../models/scheduledFacebookPost');
const { hasPermission } = require('../../utilities/permissions');
const {
  cancelScheduledPost,
  getPostHistory,
  getScheduledPosts,
  postToFacebook,
  postToFacebookWithImage,
  scheduleFacebookPost,
  scheduleFacebookPostWithImage,
  updateScheduledPost,
} = require('../facebookController');

const USER = { requestorId: 'owner-id', role: 'Owner', permissions: ['postFacebookContent'] };
const CREDENTIALS = {
  pageId: '12345',
  pageName: 'One Community',
  pageAccessToken: 'page-token',
};
const POST_ID = '507f1f77bcf86cd799439011';

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

const makeFindQuery = (posts = []) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(posts),
});

describe('facebookController secure behavior', () => {
  let consoleLog;
  let consoleError;
  let consoleWarn;

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    FacebookConnection.getActiveConnection.mockResolvedValue(CREDENTIALS);
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  describe('server-owned Mongo filters', () => {
    it.each([
      ['pending', { status: 'pending' }],
      ['sending', { status: 'sending' }],
      ['sent', { status: 'sent' }],
      ['failed', { status: 'failed' }],
    ])('uses the literal scheduled-post filter for %s', async (status, expectedFilter) => {
      ScheduledFacebookPost.find.mockReturnValue(makeFindQuery([]));
      ScheduledFacebookPost.countDocuments.mockResolvedValue(0);
      const res = makeResponse();

      await getScheduledPosts({ user: USER, query: { status, limit: '500', skip: '-2' } }, res);

      expect(ScheduledFacebookPost.find).toHaveBeenCalledWith(expectedFilter);
      expect(ScheduledFacebookPost.countDocuments).toHaveBeenCalledWith(expectedFilter);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ pagination: { total: 0, limit: 200, skip: 0 } }),
      );
    });

    it.each([[{ $ne: 'failed' }], [{ $gt: '' }], [['pending', 'sent']], ['unexpected']])(
      'uses the scheduled default for unsafe status %p',
      async (status) => {
        const query = makeFindQuery([{ _id: 'one', imageMimeType: 'image/png' }]);
        ScheduledFacebookPost.find.mockReturnValue(query);
        ScheduledFacebookPost.countDocuments.mockResolvedValue(1);
        const res = makeResponse();

        await getScheduledPosts({ user: USER, query: { status } }, res);

        const expected = { status: { $in: ['pending', 'sending'] } };
        expect(ScheduledFacebookPost.find).toHaveBeenCalledWith(expected);
        expect(ScheduledFacebookPost.countDocuments).toHaveBeenCalledWith(expected);
        expect(res.send).toHaveBeenCalledWith(
          expect.objectContaining({
            scheduledPosts: [expect.objectContaining({ hasImage: true })],
          }),
        );
      },
    );

    it.each([
      ['sent', 'direct', { status: 'sent', postMethod: 'direct' }],
      ['failed', 'scheduled', { status: 'failed', postMethod: 'scheduled' }],
      ['pending', 'direct', { status: { $in: ['sent', 'failed'] }, postMethod: 'direct' }],
      [undefined, undefined, { status: { $in: ['sent', 'failed'] } }],
    ])(
      'uses literal history filters for status=%p method=%p',
      async (status, postMethod, expectedFilter) => {
        ScheduledFacebookPost.find.mockReturnValue(makeFindQuery([]));
        const res = makeResponse();

        await getPostHistory({ user: USER, query: { source: 'mongodb', status, postMethod } }, res);

        expect(ScheduledFacebookPost.find).toHaveBeenCalledWith(expectedFilter);
        expect(axios.get).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      },
    );

    it.each([
      [{ $ne: 'sent' }, { $gt: '' }],
      [['sent'], ['direct']],
      ['unexpected', 'unexpected'],
    ])('does not propagate unsafe history filters %p / %p', async (status, postMethod) => {
      ScheduledFacebookPost.find.mockReturnValue(makeFindQuery([]));
      const res = makeResponse();

      await getPostHistory({ user: USER, query: { source: 'mongodb', status, postMethod } }, res);

      expect(ScheduledFacebookPost.find).toHaveBeenCalledWith({
        status: { $in: ['sent', 'failed'] },
      });
    });
  });

  describe('trusted Facebook destinations', () => {
    it('ignores an attacker-controlled pageId and persists the connected pageId', async () => {
      const laterCredentials = { ...CREDENTIALS, pageId: '77777' };
      FacebookConnection.getActiveConnection
        .mockReset()
        .mockResolvedValueOnce(CREDENTIALS)
        .mockResolvedValue(laterCredentials);
      axios.post.mockResolvedValue({ data: { id: 'facebook-id' } });
      const save = jest.fn().mockResolvedValue(undefined);
      ScheduledFacebookPost.mockImplementation((data) => ({ ...data, _id: 'history-id', save }));
      const res = makeResponse();

      await postToFacebook({ user: USER, body: { message: 'hello', pageId: '99999' } }, res);

      expect(axios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v19.0/12345/feed',
        expect.objectContaining({ message: 'hello' }),
      );
      expect(FacebookConnection.getActiveConnection).toHaveBeenCalledTimes(1);
      expect(ScheduledFacebookPost).toHaveBeenCalledWith(
        expect.objectContaining({ pageId: CREDENTIALS.pageId }),
      );
      expect(ScheduledFacebookPost).not.toHaveBeenCalledWith(
        expect.objectContaining({ pageId: '99999' }),
      );
      expect(ScheduledFacebookPost).not.toHaveBeenCalledWith(
        expect.objectContaining({ pageId: laterCredentials.pageId }),
      );
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        postId: 'facebook-id',
        postType: 'feed',
      });
    });

    it('preserves facebook-only history semantics when pageId does not match', async () => {
      const res = makeResponse();

      await getPostHistory({ user: USER, query: { source: 'facebook', pageId: '99999' } }, res);

      expect(axios.get).not.toHaveBeenCalled();
      expect(ScheduledFacebookPost.find).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: [],
          facebookApiError: 'No valid Facebook Page ID available. Showing database posts only.',
        }),
      );
    });

    it('keeps Mongo history for source=all but skips Graph on an invalid pageId', async () => {
      ScheduledFacebookPost.find.mockReturnValue(
        makeFindQuery([
          { _id: 'mongo-id', message: 'stored', status: 'sent', createdAt: new Date('2026-01-01') },
        ]),
      );
      const res = makeResponse();

      await getPostHistory({ user: USER, query: { source: 'all', pageId: { $gt: '' } } }, res);

      expect(axios.get).not.toHaveBeenCalled();
      expect(ScheduledFacebookPost.find).toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ posts: [expect.objectContaining({ source: 'mongodb' })] }),
      );
    });
  });

  describe('URL image validation', () => {
    it.each([
      'http://images.example/photo.jpg',
      'https://localhost/photo.jpg',
      'https://127.0.0.1/photo.jpg',
      'https://user:password@images.example/photo.jpg',
      'https://images.example/photo.jpg#fragment',
      { $ne: 'https://images.example/photo.jpg' },
    ])('rejects unsafe imageUrl %p before axios', async (imageUrl) => {
      const res = makeResponse();

      await postToFacebook({ user: USER, body: { imageUrl } }, res);

      expect(axios.post).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('normalizes and sends a public HTTPS image URL to the trusted photos endpoint', async () => {
      axios.post.mockResolvedValue({ data: { id: 'photo-id' } });
      const save = jest.fn().mockResolvedValue(undefined);
      ScheduledFacebookPost.mockImplementation((data) => ({ ...data, _id: 'history-id', save }));
      const res = makeResponse();

      await postToFacebook(
        {
          user: USER,
          body: { imageUrl: 'https://images.example/photo.jpg', pageId: '99999' },
        },
        res,
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v19.0/12345/photos',
        expect.objectContaining({ url: 'https://images.example/photo.jpg' }),
      );
      expect(ScheduledFacebookPost).toHaveBeenCalledWith(
        expect.objectContaining({ pageId: CREDENTIALS.pageId }),
      );
      expect(ScheduledFacebookPost).not.toHaveBeenCalledWith(
        expect.objectContaining({ pageId: '99999' }),
      );
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        postId: 'photo-id',
        postType: 'photo',
      });
    });

    it('rejects an unsafe URL when scheduling without creating a model', async () => {
      const res = makeResponse();

      await scheduleFacebookPost(
        {
          user: USER,
          body: {
            imageUrl: 'http://localhost/image.png',
            scheduledFor: '2099-01-01T12:00:00.000Z',
            timezone: 'UTC',
          },
        },
        res,
      );

      expect(ScheduledFacebookPost).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('scheduled post IDs and mutations', () => {
    it.each([[{ $ne: null }], [['507f1f77bcf86cd799439011']], ['not-an-object-id']])(
      'rejects unsafe cancellation ID %p before querying',
      async (postId) => {
        const res = makeResponse();

        await cancelScheduledPost({ user: USER, params: { postId } }, res);

        expect(ScheduledFacebookPost.findById).not.toHaveBeenCalled();
        expect(ScheduledFacebookPost.findByIdAndDelete).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      },
    );

    it('cancels a pending post using a converted ObjectId', async () => {
      ScheduledFacebookPost.findById.mockResolvedValue({ status: 'pending' });
      ScheduledFacebookPost.findByIdAndDelete.mockResolvedValue({});
      const res = makeResponse();

      await cancelScheduledPost({ user: USER, params: { postId: POST_ID } }, res);

      const lookupId = ScheduledFacebookPost.findById.mock.calls[0][0];
      const deleteId = ScheduledFacebookPost.findByIdAndDelete.mock.calls[0][0];
      expect(lookupId.toHexString()).toBe(POST_ID);
      expect(deleteId.toHexString()).toBe(POST_ID);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('does not update a pending post with an unsafe image URL', async () => {
      const post = { status: 'pending', save: jest.fn() };
      ScheduledFacebookPost.findById.mockResolvedValue(post);
      const res = makeResponse();

      await updateScheduledPost(
        { user: USER, params: { postId: POST_ID }, body: { imageUrl: 'https://localhost/a' } },
        res,
      );

      expect(post.save).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects an operator-shaped update ID before querying', async () => {
      const res = makeResponse();

      await updateScheduledPost(
        { user: USER, params: { postId: { $gt: '' } }, body: { message: 'changed' } },
        res,
      );

      expect(ScheduledFacebookPost.findById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('updates allowed fields and a normalized image URL on a pending post', async () => {
      const post = {
        status: 'pending',
        timezone: 'UTC',
        save: jest.fn().mockResolvedValue(undefined),
      };
      ScheduledFacebookPost.findById.mockResolvedValue(post);
      const res = makeResponse();

      await updateScheduledPost(
        {
          user: USER,
          params: { postId: POST_ID },
          body: {
            message: 'updated',
            link: 'https://onecommunityglobal.org',
            imageUrl: 'https://images.example/a.png',
            scheduledFor: '2099-01-02T12:00:00.000Z',
            timezone: 'UTC',
          },
        },
        res,
      );

      expect(post).toEqual(
        expect.objectContaining({
          message: 'updated',
          link: 'https://onecommunityglobal.org',
          imageUrl: 'https://images.example/a.png',
          scheduledFor: expect.any(Date),
        }),
      );
      expect(post.save).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('image upload handlers', () => {
    it('posts an uploaded image and records trusted-page history', async () => {
      axios.post.mockResolvedValue({ data: { id: 'uploaded-id' } });
      const save = jest.fn().mockResolvedValue(undefined);
      ScheduledFacebookPost.mockImplementation((data) => ({ ...data, _id: 'history-id', save }));
      const res = makeResponse();

      await postToFacebookWithImage(
        {
          user: USER,
          body: { message: 'image', pageId: '99999' },
          file: {
            buffer: Buffer.from('image'),
            mimetype: 'image/png',
            originalname: 'photo.png',
          },
        },
        res,
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v19.0/12345/photos',
        expect.anything(),
        expect.objectContaining({ headers: expect.any(Object) }),
      );
      expect(ScheduledFacebookPost).toHaveBeenCalledWith(
        expect.objectContaining({ pageId: CREDENTIALS.pageId, imageUrl: '(uploaded: photo.png)' }),
      );
      expect(ScheduledFacebookPost).not.toHaveBeenCalledWith(
        expect.objectContaining({ pageId: '99999' }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('schedules an uploaded image without exposing image data in the response', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const toObject = jest.fn().mockReturnValue({
        _id: 'scheduled-id',
        message: 'later',
        imageData: Buffer.from('image'),
      });
      ScheduledFacebookPost.mockImplementation((data) => ({ ...data, save, toObject }));
      const res = makeResponse();

      await scheduleFacebookPostWithImage(
        {
          user: USER,
          body: {
            message: ' later ',
            pageId: CREDENTIALS.pageId,
            scheduledFor: '2099-01-01T12:00:00.000Z',
            timezone: 'UTC',
          },
          file: {
            buffer: Buffer.from('image'),
            mimetype: 'image/webp',
            originalname: 'photo.webp',
          },
        },
        res,
      );

      expect(ScheduledFacebookPost).toHaveBeenCalledWith(
        expect.objectContaining({ pageId: CREDENTIALS.pageId, message: 'later' }),
      );
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        scheduledPost: { _id: 'scheduled-id', message: 'later', hasImage: true },
      });
    });
  });

  describe('observable failure handling', () => {
    it('rejects an empty direct post before axios', async () => {
      const res = makeResponse();

      await postToFacebook({ user: USER, body: {} }, res);

      expect(axios.post).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        error: 'Failed to post to Facebook',
        details: 'message, link, imageUrl, or image file is required to create a Facebook post.',
      });
    });

    it('reports missing Facebook credentials without attempting a post', async () => {
      FacebookConnection.getActiveConnection.mockResolvedValue(null);
      const res = makeResponse();

      await postToFacebook({ user: USER, body: { message: 'hello' } }, res);

      expect(axios.post).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ details: expect.stringContaining('Facebook is not connected') }),
      );
    });

    it('preserves Facebook Graph error status and details', async () => {
      axios.post.mockRejectedValue({
        response: { status: 429, data: { error: { message: 'Rate limited', code: 4 } } },
      });
      const res = makeResponse();

      await postToFacebook({ user: USER, body: { message: 'hello' } }, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send).toHaveBeenCalledWith({
        error: 'Failed to post to Facebook',
        details: { message: 'Rate limited', code: 4 },
      });
    });

    it('rejects multipart posting without an image', async () => {
      const res = makeResponse();

      await postToFacebookWithImage({ user: USER, body: {} }, res);

      expect(axios.post).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        error: 'No image file provided. Use the regular post endpoint for URL-based images.',
      });
    });

    it('reports a scheduled-list query failure', async () => {
      ScheduledFacebookPost.find.mockImplementation(() => {
        throw new Error('database unavailable');
      });
      const res = makeResponse();

      await getScheduledPosts({ user: USER, query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        error: 'Failed to fetch scheduled posts',
        details: 'database unavailable',
      });
    });

    it('maps Facebook history results and preserves engagement counts', async () => {
      axios.get.mockResolvedValue({
        data: {
          data: [
            {
              id: 'fb-post',
              message: 'from Facebook',
              created_time: '2026-01-02T00:00:00.000Z',
              permalink_url: 'https://facebook.example/post',
              full_picture: 'https://images.example/post.jpg',
              type: 'photo',
              shares: { count: 2 },
              reactions: { summary: { total_count: 3 } },
              comments: { summary: { total_count: 4 } },
            },
          ],
        },
      });
      const res = makeResponse();

      await getPostHistory({ user: USER, query: { source: 'facebook', limit: '1' } }, res);

      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: [
            expect.objectContaining({
              postId: 'fb-post',
              source: 'facebook',
              shares: 2,
              reactions: 3,
              comments: 4,
            }),
          ],
        }),
      );
    });

    it('returns the established expired-token indication for Graph history failures', async () => {
      axios.get.mockRejectedValue({
        response: { data: { error: { code: 190, message: 'expired upstream message' } } },
      });
      const res = makeResponse();

      await getPostHistory({ user: USER, query: { source: 'facebook' } }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          posts: [],
          facebookApiError: 'Facebook access token expired. Please reconnect your Facebook Page.',
        }),
      );
    });

    it.each([
      [null, 404, 'Scheduled post not found.'],
      [{ status: 'sent' }, 400, 'Only pending posts can be cancelled.'],
    ])('handles non-cancellable records without deleting them', async (post, status, errorText) => {
      ScheduledFacebookPost.findById.mockResolvedValue(post);
      const res = makeResponse();

      await cancelScheduledPost({ user: USER, params: { postId: POST_ID } }, res);

      expect(ScheduledFacebookPost.findByIdAndDelete).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.send.mock.calls[0][0].error).toContain(errorText);
    });

    it.each([
      [null, 404, 'Scheduled post not found.'],
      [{ status: 'sent' }, 400, 'Only pending posts can be updated.'],
    ])('handles non-updatable records without saving them', async (post, status, errorText) => {
      ScheduledFacebookPost.findById.mockResolvedValue(post);
      const res = makeResponse();

      await updateScheduledPost(
        { user: USER, params: { postId: POST_ID }, body: { message: 'changed' } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.send.mock.calls[0][0].error).toContain(errorText);
    });

    it('rejects an invalid reschedule time without saving', async () => {
      const post = { status: 'pending', timezone: 'UTC', save: jest.fn() };
      ScheduledFacebookPost.findById.mockResolvedValue(post);
      const res = makeResponse();

      await updateScheduledPost(
        {
          user: USER,
          params: { postId: POST_ID },
          body: { scheduledFor: 'not-a-date', timezone: 'UTC' },
        },
        res,
      );

      expect(post.save).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: 'Invalid scheduledFor date/time provided.' });
    });
  });
});
