jest.mock('../../models/instagramScheduledPost');
jest.mock('../../models/instagramPostHistory');
jest.mock('../instagramServices');

const InstagramScheduledPost = require('../../models/instagramScheduledPost');
const InstagramPostHistory = require('../../models/instagramPostHistory');
const { publishInstagramPost } = require('../instagramServices');
const { runInstagramScheduler } = require('../instagramScheduler');

describe('runInstagramScheduler', () => {
  const OLD_ENV = process.env;
  let originalConsoleError;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      INSTAGRAM_ACCOUNT_ID: 'ig-account-123',
      INSTAGRAM_ACCESS_TOKEN: 'token-abc',
    };

    // The scheduler intentionally console.errors on every failed publish.
    // Manage the replacement manually (rather than via jest.spyOn) so this
    // isn't affected by restoreMocks/resetMocks/clearMocks config or by
    // hook ordering with any global test setup file.
    originalConsoleError = console.error;
    consoleErrorSpy = jest.fn();
    console.error = consoleErrorSpy;

    // Default: find().limit() resolves to an empty array unless overridden.
    InstagramScheduledPost.find.mockReturnValue({
      limit: jest.fn().mockResolvedValue([]),
    });
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  const mockFindResults = (posts) => {
    InstagramScheduledPost.find.mockReturnValue({
      limit: jest.fn().mockResolvedValue(posts),
    });
  };

  describe('querying due posts', () => {
    it('queries for scheduled posts due at or before now, limited to 20', async () => {
      await runInstagramScheduler();

      expect(InstagramScheduledPost.find).toHaveBeenCalledTimes(1);
      const queryArg = InstagramScheduledPost.find.mock.calls[0][0];

      expect(queryArg.status).toBe('scheduled');
      expect(queryArg.scheduledTime).toHaveProperty('$lte');
      expect(queryArg.scheduledTime.$lte).toBeInstanceOf(Date);

      const limitFn = InstagramScheduledPost.find.mock.results[0].value.limit;
      expect(limitFn).toHaveBeenCalledWith(20);
    });

    it('does nothing else when there are no due posts', async () => {
      mockFindResults([]);

      await runInstagramScheduler();

      expect(publishInstagramPost).not.toHaveBeenCalled();
      expect(InstagramScheduledPost.findOneAndUpdate).not.toHaveBeenCalled();
      expect(InstagramScheduledPost.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(InstagramPostHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('locking', () => {
    it('skips a post if it could not be locked (already claimed by another run)', async () => {
      const post = {
        _id: 'post-1',
        userId: 'user-1',
        caption: 'hello world',
        mediaUrl: 'https://example.com/img.jpg',
        mediaType: 'IMAGE',
      };
      mockFindResults([post]);
      InstagramScheduledPost.findOneAndUpdate.mockResolvedValue(null);

      await runInstagramScheduler();

      expect(InstagramScheduledPost.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: post._id, status: 'scheduled' },
        { $set: { status: 'publishing' }, $inc: { attempts: 1 } },
        { new: true },
      );
      expect(publishInstagramPost).not.toHaveBeenCalled();
      expect(InstagramScheduledPost.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(InstagramPostHistory.create).not.toHaveBeenCalled();
    });

    it('proceeds to publish once the post is successfully locked', async () => {
      const post = {
        _id: 'post-1',
        userId: 'user-1',
        caption: 'hello world',
        mediaUrl: 'https://example.com/img.jpg',
        mediaType: 'IMAGE',
      };
      mockFindResults([post]);
      InstagramScheduledPost.findOneAndUpdate.mockResolvedValue({
        ...post,
        status: 'publishing',
        attempts: 1,
      });
      publishInstagramPost.mockResolvedValue({
        creationId: 'creation-1',
        instagramMediaId: 'media-1',
        permalink: 'https://instagram.com/p/media-1',
      });
      InstagramScheduledPost.findByIdAndUpdate.mockResolvedValue({});
      InstagramPostHistory.create.mockResolvedValue({});

      await runInstagramScheduler();

      expect(publishInstagramPost).toHaveBeenCalledWith({
        instagramAccountId: 'ig-account-123',
        accessToken: 'token-abc',
        caption: post.caption,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
      });
    });
  });

  describe('successful publish', () => {
    const post = {
      _id: 'post-1',
      userId: 'user-1',
      caption: 'hello world',
      mediaUrl: 'https://example.com/img.jpg',
      mediaType: 'IMAGE',
    };
    const publishResult = {
      creationId: 'creation-1',
      instagramMediaId: 'media-1',
      permalink: 'https://instagram.com/p/media-1',
    };

    beforeEach(() => {
      mockFindResults([post]);
      InstagramScheduledPost.findOneAndUpdate.mockResolvedValue({
        ...post,
        status: 'publishing',
      });
      publishInstagramPost.mockResolvedValue(publishResult);
      InstagramScheduledPost.findByIdAndUpdate.mockResolvedValue({});
      InstagramPostHistory.create.mockResolvedValue({});
    });

    it('marks the scheduled post as published with the returned metadata', async () => {
      await runInstagramScheduler();

      expect(InstagramScheduledPost.findByIdAndUpdate).toHaveBeenCalledWith(post._id, {
        status: 'published',
        creationId: publishResult.creationId,
        instagramMediaId: publishResult.instagramMediaId,
        permalink: publishResult.permalink,
        lastError: null,
      });
    });

    it('creates a published history entry', async () => {
      await runInstagramScheduler();

      expect(InstagramPostHistory.create).toHaveBeenCalledTimes(1);
      const historyArg = InstagramPostHistory.create.mock.calls[0][0];

      expect(historyArg).toMatchObject({
        userId: post.userId,
        caption: post.caption,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        instagramMediaId: publishResult.instagramMediaId,
        permalink: publishResult.permalink,
        status: 'published',
      });
      expect(historyArg.postedAt).toBeInstanceOf(Date);
    });

    it('does not write a failed status anywhere on success', async () => {
      await runInstagramScheduler();

      expect(InstagramScheduledPost.findByIdAndUpdate).not.toHaveBeenCalledWith(
        post._id,
        expect.objectContaining({ status: 'failed' }),
      );
    });
  });

  describe('failed publish', () => {
    const post = {
      _id: 'post-2',
      userId: 'user-2',
      caption: 'oops',
      mediaUrl: 'https://example.com/broken.jpg',
      mediaType: 'IMAGE',
    };

    beforeEach(() => {
      mockFindResults([post]);
      InstagramScheduledPost.findOneAndUpdate.mockResolvedValue({
        ...post,
        status: 'publishing',
      });
      InstagramScheduledPost.findByIdAndUpdate.mockResolvedValue({});
      InstagramPostHistory.create.mockResolvedValue({});
    });

    it('uses err.response.data.error.message when present, and updates status to failed', async () => {
      const error = new Error('generic failure');
      error.response = { data: { error: { message: 'Invalid media URL' } } };
      publishInstagramPost.mockRejectedValue(error);

      await runInstagramScheduler();

      expect(InstagramScheduledPost.findByIdAndUpdate).toHaveBeenCalledWith(post._id, {
        status: 'failed',
        lastError: 'Invalid media URL',
      });

      expect(InstagramPostHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: post.userId,
          status: 'failed',
          error: 'Invalid media URL',
        }),
      );
    });

    it('falls back to err.message when there is no response payload', async () => {
      const error = new Error('network timeout');
      publishInstagramPost.mockRejectedValue(error);

      await runInstagramScheduler();

      expect(InstagramScheduledPost.findByIdAndUpdate).toHaveBeenCalledWith(post._id, {
        status: 'failed',
        lastError: 'network timeout',
      });

      expect(InstagramPostHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: 'network timeout',
        }),
      );
    });

    it('does not create a published history entry when publishing fails', async () => {
      publishInstagramPost.mockRejectedValue(new Error('boom'));

      await runInstagramScheduler();

      expect(InstagramPostHistory.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'published' }),
      );
    });

    it('continues processing subsequent posts after one fails', async () => {
      const secondPost = {
        _id: 'post-3',
        userId: 'user-3',
        caption: 'good post',
        mediaUrl: 'https://example.com/good.jpg',
        mediaType: 'IMAGE',
      };
      mockFindResults([post, secondPost]);

      InstagramScheduledPost.findOneAndUpdate
        .mockResolvedValueOnce({ ...post, status: 'publishing' })
        .mockResolvedValueOnce({ ...secondPost, status: 'publishing' });

      publishInstagramPost
        .mockRejectedValueOnce(new Error('first post failed'))
        .mockResolvedValueOnce({
          creationId: 'creation-3',
          instagramMediaId: 'media-3',
          permalink: 'https://instagram.com/p/media-3',
        });

      await runInstagramScheduler();

      expect(publishInstagramPost).toHaveBeenCalledTimes(2);
      expect(InstagramScheduledPost.findByIdAndUpdate).toHaveBeenCalledWith(
        post._id,
        expect.objectContaining({ status: 'failed' }),
      );
      expect(InstagramScheduledPost.findByIdAndUpdate).toHaveBeenCalledWith(
        secondPost._id,
        expect.objectContaining({ status: 'published' }),
      );
    });

    it('logs the error via console.error without throwing', async () => {
      publishInstagramPost.mockRejectedValue(new Error('boom'));

      await expect(runInstagramScheduler()).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Instagram Scheduler] Failed'),
        'boom',
      );
    });
  });

  describe('multiple posts, mixed lock outcomes', () => {
    it('only calls publishInstagramPost for posts that were successfully locked', async () => {
      const lockedPost = {
        _id: 'a',
        userId: 'u1',
        caption: 'c1',
        mediaUrl: 'm1',
        mediaType: 'IMAGE',
      };
      const contestedPost = {
        _id: 'b',
        userId: 'u2',
        caption: 'c2',
        mediaUrl: 'm2',
        mediaType: 'IMAGE',
      };
      mockFindResults([lockedPost, contestedPost]);

      InstagramScheduledPost.findOneAndUpdate
        .mockResolvedValueOnce({ ...lockedPost, status: 'publishing' })
        .mockResolvedValueOnce(null);

      publishInstagramPost.mockResolvedValue({
        creationId: 'c',
        instagramMediaId: 'm',
        permalink: 'p',
      });

      await runInstagramScheduler();

      expect(publishInstagramPost).toHaveBeenCalledTimes(1);
      expect(publishInstagramPost).toHaveBeenCalledWith(
        expect.objectContaining({ caption: lockedPost.caption }),
      );
    });
  });
});
