jest.mock('axios');
jest.mock('node-schedule', () => ({
  scheduleJob: jest.fn(),
}));
jest.mock('../models/imgurPosts');

const originalClientId = process.env.IMGUR_CLIENT_ID;
const originalClientSecret = process.env.IMGUR_CLIENT_SECRET;
const originalAccessToken = process.env.IMGUR_ACCESS_TOKEN;
const originalRefreshToken = process.env.IMGUR_REFRESH_TOKEN;
process.env.IMGUR_CLIENT_ID = 'test-client-id';
process.env.IMGUR_ACCESS_TOKEN = 'test-access-token';
process.env.IMGUR_REFRESH_TOKEN = 'test-refresh-token';

const axios = require('axios');
const schedule = require('node-schedule');
const ImgurPost = require('../models/imgurPosts');
const imgurPostController = require('./imgurPostController');

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('imgurPostController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IMGUR_CLIENT_ID = 'test-client-id';
    process.env.IMGUR_ACCESS_TOKEN = 'test-access-token';
    process.env.IMGUR_REFRESH_TOKEN = 'test-refresh-token';

    schedule.scheduleJob.mockReturnValue({
      cancel: jest.fn(),
    });

    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
    console.log.mockRestore();
  });

  afterAll(() => {
    process.env.IMGUR_CLIENT_ID = originalClientId;
    process.env.IMGUR_ACCESS_TOKEN = originalAccessToken;
    process.env.IMGUR_REFRESH_TOKEN = originalRefreshToken;
    if (originalClientSecret === undefined) {
      delete process.env.IMGUR_CLIENT_SECRET;
    } else {
      process.env.IMGUR_CLIENT_SECRET = originalClientSecret;
    }
  });

  describe('postToImgur', () => {
    test('returns 400 when title is missing', async () => {
      const controller = imgurPostController();
      const req = {
        body: { userId: '507f1f77bcf86cd799439011' },
        files: [],
      };
      const res = makeRes();

      await controller.postToImgur(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Title is required' }),
      );
    });

    test('returns 400 when userId is missing', async () => {
      const controller = imgurPostController();
      const req = {
        body: { title: 'Test Album' },
        files: [],
      };
      const res = makeRes();

      await controller.postToImgur(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User ID is required' }),
      );
    });

    test('returns 400 when scheduleTime is invalid', async () => {
      const controller = imgurPostController();
      const req = {
        body: {
          title: 'Test Album',
          userId: '507f1f77bcf86cd799439011',
          scheduleTime: 'invalid-date',
        },
        files: [],
      };
      const res = makeRes();

      await controller.postToImgur(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Schedule time is invalid' }),
      );
    });

    test('returns 400 when scheduleTime is in the past', async () => {
      const controller = imgurPostController();
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const req = {
        body: {
          title: 'Test Album',
          userId: '507f1f77bcf86cd799439011',
          scheduleTime: pastDate,
        },
        files: [],
      };
      const res = makeRes();

      await controller.postToImgur(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Schedule time must be in the future' }),
      );
    });

    test('schedules post when scheduleTime is provided', async () => {
      const controller = imgurPostController();
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const mockPostRecord = {
        _id: '507f1f77bcf86cd799439012',
        title: 'Test Album',
        userId: '507f1f77bcf86cd799439011',
      };

      ImgurPost.create.mockResolvedValue(mockPostRecord);

      const req = {
        body: {
          title: 'Test Album',
          description: 'Test Description',
          userId: '507f1f77bcf86cd799439011',
          scheduleTime: futureDate,
        },
        files: [],
      };
      const res = makeRes();

      await controller.postToImgur(req, res);

      expect(ImgurPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Album',
          description: 'Test Description',
          status: 'pending',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Post scheduled successfully',
        }),
      );
    });

    test('posts immediately when no scheduleTime is provided', async () => {
      const controller = imgurPostController();
      const mockPostRecord = {
        _id: '507f1f77bcf86cd799439012',
        title: 'Test Album',
        userId: '507f1f77bcf86cd799439011',
        save: jest.fn().mockResolvedValue({}),
      };

      axios.post.mockResolvedValueOnce({ data: { success: true, data: { id: 'album123' } } });
      axios.post.mockResolvedValueOnce({ data: { success: true, data: { id: 'image123' } } });
      axios.post.mockResolvedValueOnce({ data: { success: true } });
      ImgurPost.create.mockResolvedValue(mockPostRecord);

      const req = {
        body: {
          title: 'Test Album',
          description: 'Test Description',
          userId: '507f1f77bcf86cd799439011',
        },
        files: [
          {
            originalname: 'test.jpg',
            mimetype: 'image/jpeg',
            size: 1024,
            buffer: Buffer.from('test-image-data'),
          },
        ],
      };
      const res = makeRes();

      await controller.postToImgur(req, res);

      // At minimum, verify the function executed without error
      expect(axios.post).toHaveBeenCalledTimes(3);
      expect(ImgurPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'posted',
          albumId: 'album123',
          imgurUrl: 'https://imgur.com/a/album123',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          albumId: 'album123',
          imgurUrl: 'https://imgur.com/a/album123',
        }),
      );
    });

    test('returns 500 when Imgur API call fails', async () => {
      const controller = imgurPostController();
      const error = new Error('API Error');
      error.response = { data: { error: 'Album creation failed' } };

      axios.post.mockRejectedValue(error);

      const req = {
        body: {
          title: 'Test Album',
          userId: '507f1f77bcf86cd799439011',
        },
        files: [
          {
            originalname: 'test.jpg',
            mimetype: 'image/jpeg',
            size: 1024,
            buffer: Buffer.from('test-image-data'),
          },
        ],
      };
      const res = makeRes();

      await controller.postToImgur(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    test('returns 500 when album creation reports a failure', async () => {
      const controller = imgurPostController();
      axios.post.mockResolvedValueOnce({
        data: { success: false, data: { error: 'Album rejected' } },
      });
      const res = makeRes();

      await controller.postToImgur(
        {
          body: { title: 'Test Album', userId: '507f1f77bcf86cd799439011' },
          files: [],
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(ImgurPost.create).not.toHaveBeenCalled();
    });

    test('returns 500 when image upload reports a failure', async () => {
      const controller = imgurPostController();
      axios.post
        .mockResolvedValueOnce({ data: { success: true, data: { id: 'album123' } } })
        .mockResolvedValueOnce({
          data: { success: false, data: { error: 'Image rejected' } },
        });
      const res = makeRes();

      await controller.postToImgur(
        {
          body: { title: 'Test Album', userId: '507f1f77bcf86cd799439011' },
          files: [
            {
              originalname: 'test.jpg',
              mimetype: 'image/jpeg',
              size: 10,
              buffer: Buffer.from('image'),
            },
          ],
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(ImgurPost.create).not.toHaveBeenCalled();
    });

    test('returns 500 when adding images to the album reports a failure', async () => {
      const controller = imgurPostController();
      axios.post
        .mockResolvedValueOnce({ data: { success: true, data: { id: 'album123' } } })
        .mockResolvedValueOnce({ data: { success: true, data: { id: 'image123' } } })
        .mockResolvedValueOnce({
          data: { success: false, data: { error: 'Unable to add image' } },
        });
      const res = makeRes();

      await controller.postToImgur(
        {
          body: { title: 'Test Album', userId: '507f1f77bcf86cd799439011' },
          files: [
            {
              originalname: 'test.jpg',
              mimetype: 'image/jpeg',
              size: 10,
              buffer: Buffer.from('image'),
            },
          ],
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(ImgurPost.create).not.toHaveBeenCalled();
    });
  });

  describe('scheduled job execution', () => {
    const schedulePost = async (controller, postId) => {
      ImgurPost.create.mockResolvedValue({ _id: postId });
      await controller.postToImgur(
        {
          body: {
            title: 'Scheduled Album',
            userId: '507f1f77bcf86cd799439011',
            scheduleTime: new Date(Date.now() + 3600000).toISOString(),
          },
          files: [],
        },
        makeRes(),
      );
    };

    test('publishes a pending post and updates its record', async () => {
      const controller = imgurPostController();
      const postRecord = {
        title: 'Scheduled Album',
        description: 'Scheduled description',
        images: [],
        userId: '507f1f77bcf86cd799439011',
        status: 'pending',
        attempts: 0,
        save: jest.fn().mockResolvedValue({}),
      };
      ImgurPost.findById.mockResolvedValue(postRecord);
      axios.post.mockResolvedValueOnce({
        data: { success: true, data: { id: 'scheduled-album' } },
      });
      await schedulePost(controller, 'scheduled-post');

      await schedule.scheduleJob.mock.calls[0][1]();

      expect(postRecord.status).toBe('posted');
      expect(postRecord.albumId).toBe('scheduled-album');
      expect(postRecord.remotePostId).toBe('scheduled-album');
      expect(postRecord.imgurUrl).toBe('https://imgur.com/a/scheduled-album');
      expect(postRecord.attempts).toBe(1);
      expect(postRecord.save).toHaveBeenCalledTimes(2);
    });

    test('marks a post failed when scheduled publication throws', async () => {
      const controller = imgurPostController();
      const postRecord = {
        title: 'Scheduled Album',
        description: '',
        images: [],
        userId: '507f1f77bcf86cd799439011',
        status: 'pending',
        attempts: 0,
        lockOwner: 'worker',
        lockedUntil: new Date(),
        save: jest.fn().mockResolvedValue({}),
      };
      ImgurPost.findById.mockResolvedValue(postRecord);
      axios.post.mockRejectedValueOnce(new Error('Imgur unavailable'));
      await schedulePost(controller, 'scheduled-post');

      await schedule.scheduleJob.mock.calls[0][1]();

      expect(postRecord.status).toBe('failed');
      expect(postRecord.lastError).toContain('Imgur unavailable');
      expect(postRecord.attempts).toBe(1);
      expect(postRecord.lockOwner).toBeNull();
      expect(postRecord.lockedUntil).toBeNull();
      expect(postRecord.save).toHaveBeenCalledTimes(2);
    });

    test('ignores a missing or non-pending post', async () => {
      const controller = imgurPostController();
      await schedulePost(controller, 'scheduled-post');
      ImgurPost.findById.mockResolvedValue(null);

      await schedule.scheduleJob.mock.calls[0][1]();

      const anotherController = imgurPostController();
      await schedulePost(anotherController, 'already-published-post');
      ImgurPost.findById.mockResolvedValue({ status: 'posted' });

      await schedule.scheduleJob.mock.calls[1][1]();

      expect(ImgurPost.findById).toHaveBeenCalledTimes(2);
    });
  });

  describe('getScheduledPosts', () => {
    test('returns scheduled posts for user', async () => {
      const controller = imgurPostController();
      const mockPosts = [
        {
          _id: '507f1f77bcf86cd799439012',
          title: 'Test Album 1',
          status: 'pending',
        },
        {
          _id: '507f1f77bcf86cd799439013',
          title: 'Test Album 2',
          status: 'publishing',
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockPosts),
      };

      ImgurPost.find.mockReturnValue(mockQuery);

      const req = {
        user: { _id: '507f1f77bcf86cd799439011' },
        query: {},
      };
      const res = makeRes();

      await controller.getScheduledPosts(req, res);

      expect(ImgurPost.find).toHaveBeenCalledWith({
        status: { $ne: 'posted' },
        userId: '507f1f77bcf86cd799439011',
      });
      expect(mockQuery.select).toHaveBeenCalledWith('-images.buffer');
      expect(mockQuery.sort).toHaveBeenCalledWith({ scheduledTime: 1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          posts: mockPosts,
        }),
      );
    });

    test('excludes image buffers from response', async () => {
      const controller = imgurPostController();
      const mockPosts = [
        {
          _id: '507f1f77bcf86cd799439012',
          title: 'Test Album 1',
          status: 'pending',
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockPosts),
      };

      ImgurPost.find.mockReturnValue(mockQuery);

      const req = {
        user: { _id: '507f1f77bcf86cd799439011' },
        query: {},
      };
      const res = makeRes();

      await controller.getScheduledPosts(req, res);

      expect(mockQuery.select).toHaveBeenCalledWith('-images.buffer');
    });

    test('returns 500 when database query fails', async () => {
      const controller = imgurPostController();
      const error = new Error('Database error');

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(error),
      };

      ImgurPost.find.mockReturnValue(mockQuery);

      const req = {
        user: { _id: '507f1f77bcf86cd799439011' },
        query: {},
      };
      const res = makeRes();

      await controller.getScheduledPosts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Failed to fetch scheduled posts',
        }),
      );
    });
  });

  describe('deleteScheduledPost', () => {
    test('deletes a pending post', async () => {
      const controller = imgurPostController();
      const job = { cancel: jest.fn() };
      schedule.scheduleJob.mockReturnValue(job);
      ImgurPost.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
      });
      ImgurPost.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await controller.postToImgur(
        {
          body: {
            title: 'Scheduled post',
            userId: '507f1f77bcf86cd799439011',
            scheduleTime: new Date(Date.now() + 3600000).toISOString(),
          },
          files: [],
        },
        makeRes(),
      );

      const req = { params: { postId: '507f1f77bcf86cd799439012' } };
      const res = makeRes();

      await controller.deleteScheduledPost(req, res);

      expect(ImgurPost.deleteOne).toHaveBeenCalledWith({
        _id: '507f1f77bcf86cd799439012',
        status: { $in: ['pending'] },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Scheduled post deleted successfully',
        }),
      );
      expect(job.cancel).toHaveBeenCalledTimes(1);
    });

    test('returns 404 when post is not found or being published', async () => {
      const controller = imgurPostController();
      ImgurPost.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const req = { params: { postId: '507f1f77bcf86cd799439012' } };
      const res = makeRes();

      await controller.deleteScheduledPost(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Scheduled post not found or already being published',
        }),
      );
    });

    test('returns 500 when deletion fails', async () => {
      const controller = imgurPostController();
      const error = new Error('Deletion failed');
      ImgurPost.deleteOne.mockRejectedValue(error);

      const req = { params: { postId: '507f1f77bcf86cd799439012' } };
      const res = makeRes();

      await controller.deleteScheduledPost(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Failed to delete scheduled post',
        }),
      );
    });
  });

  describe('updateScheduledPost', () => {
    test('updates a pending post', async () => {
      const controller = imgurPostController();
      const mockPost = {
        _id: '507f1f77bcf86cd799439012',
        title: 'Original Title',
        description: 'Original Description',
        images: [],
        scheduledTime: new Date(),
        status: 'pending',
        save: jest.fn().mockResolvedValue({}),
      };

      ImgurPost.findOne.mockResolvedValue(mockPost);

      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const req = {
        params: { postId: '507f1f77bcf86cd799439012' },
        body: {
          title: 'Updated Title',
          description: 'Updated Description',
          scheduleTime: futureDate,
        },
        files: [],
      };
      const res = makeRes();

      await controller.updateScheduledPost(req, res);

      expect(mockPost.title).toBe('Updated Title');
      expect(mockPost.description).toBe('Updated Description');
      expect(mockPost.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Post updated successfully',
        }),
      );
    });

    test('cancels the previous job and schedules the updated time', async () => {
      const controller = imgurPostController();
      const oldJob = { cancel: jest.fn() };
      const newJob = { cancel: jest.fn() };
      schedule.scheduleJob.mockReturnValueOnce(oldJob).mockReturnValueOnce(newJob);
      const mockPost = {
        _id: '507f1f77bcf86cd799439012',
        title: 'Original Title',
        description: 'Original Description',
        status: 'pending',
        save: jest.fn().mockResolvedValue({}),
      };
      ImgurPost.create.mockResolvedValue({ _id: mockPost._id });
      ImgurPost.findOne.mockResolvedValue(mockPost);

      await controller.postToImgur(
        {
          body: {
            title: 'Original Title',
            userId: '507f1f77bcf86cd799439011',
            scheduleTime: new Date(Date.now() + 3600000).toISOString(),
          },
          files: [],
        },
        makeRes(),
      );

      const newScheduleTime = new Date(Date.now() + 7200000).toISOString();
      const res = makeRes();
      await controller.updateScheduledPost(
        {
          params: { postId: mockPost._id },
          body: { title: 'Updated Title', scheduleTime: newScheduleTime },
          files: [],
        },
        res,
      );

      expect(oldJob.cancel).toHaveBeenCalledTimes(1);
      expect(schedule.scheduleJob).toHaveBeenCalledTimes(2);
      expect(schedule.scheduleJob.mock.calls[1][0]).toEqual(new Date(newScheduleTime));
      expect(mockPost.title).toBe('Updated Title');
      expect(mockPost.save).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('returns 404 when post not found', async () => {
      const controller = imgurPostController();
      ImgurPost.findOne.mockResolvedValue(null);

      const req = {
        params: { postId: '507f1f77bcf86cd799439012' },
        body: { title: 'Updated Title' },
        files: [],
      };
      const res = makeRes();

      await controller.updateScheduledPost(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Scheduled post not found or cannot be updated',
        }),
      );
    });

    test('returns 400 when new scheduleTime is invalid', async () => {
      const controller = imgurPostController();
      const mockPost = {
        _id: '507f1f77bcf86cd799439012',
        status: 'pending',
      };

      ImgurPost.findOne.mockResolvedValue(mockPost);

      const req = {
        params: { postId: '507f1f77bcf86cd799439012' },
        body: {
          title: 'Updated Title',
          scheduleTime: 'not-a-date',
        },
        files: [],
      };
      const res = makeRes();

      await controller.updateScheduledPost(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Schedule time is invalid',
        }),
      );
    });

    test('returns 500 when update fails', async () => {
      const controller = imgurPostController();
      const error = new Error('Update failed');
      ImgurPost.findOne.mockRejectedValue(error);

      const req = {
        params: { postId: '507f1f77bcf86cd799439012' },
        body: { title: 'Updated Title' },
        files: [],
      };
      const res = makeRes();

      await controller.updateScheduledPost(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Failed to update scheduled post',
        }),
      );
    });
  });

  describe('authorizeImgur', () => {
    test('returns 400 when authorization code is missing', async () => {
      const controller = imgurPostController();
      const req = { body: {} };
      const res = makeRes();

      await controller.authorizeImgur(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authorization code is required',
        }),
      );
    });

    test('returns 500 when Imgur client ID is not configured', async () => {
      const originalId = process.env.IMGUR_CLIENT_ID;
      const originalSecret = process.env.IMGUR_CLIENT_SECRET;

      delete process.env.IMGUR_CLIENT_ID;
      delete process.env.IMGUR_CLIENT_SECRET;

      // Create new controller with missing env vars
      const controller = imgurPostController();

      const req = { body: { code: 'auth-code-123' } };
      const res = makeRes();

      await controller.authorizeImgur(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Imgur OAuth not configured on server',
        }),
      );

      // Restore
      if (originalId) process.env.IMGUR_CLIENT_ID = originalId;
      if (originalSecret) process.env.IMGUR_CLIENT_SECRET = originalSecret;
    });

    test('handles successful token exchange when all credentials configured', async () => {
      const controller = imgurPostController();
      process.env.IMGUR_CLIENT_SECRET = 'test-client-secret';
      axios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        },
      });
      const res = makeRes();

      await controller.authorizeImgur({ body: { code: 'auth-code-123' } }, res);

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.imgur.com/oauth2/token',
        expect.objectContaining({ code: 'auth-code-123' }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
        }),
      );
      delete process.env.IMGUR_CLIENT_SECRET;
    });

    test('returns 500 when OAuth token exchange fails', async () => {
      // Set up environment
      const originalSecret = process.env.IMGUR_CLIENT_SECRET;
      process.env.IMGUR_CLIENT_SECRET = 'test-secret-fail';

      const controller = imgurPostController();

      const error = new Error('Token exchange failed');
      error.response = { data: { error: { error: 'invalid_grant' } } };
      axios.post.mockRejectedValueOnce(error);

      const req = { body: { code: 'invalid-code' } };
      const res = makeRes();

      await controller.authorizeImgur(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Authorization failed',
        }),
      );

      // Restore
      if (originalSecret !== undefined) {
        process.env.IMGUR_CLIENT_SECRET = originalSecret;
      }
    });

    test('returns 500 when the token exchange omits an access token', async () => {
      process.env.IMGUR_CLIENT_SECRET = 'test-client-secret';
      axios.post.mockResolvedValueOnce({ data: { refresh_token: 'refresh-token' } });
      const controller = imgurPostController();
      const res = makeRes();

      await controller.authorizeImgur({ body: { code: 'auth-code-123' } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Authorization failed' }),
      );
    });
  });
});
