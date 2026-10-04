const express = require('express');
const request = require('supertest');

jest.mock('../../utilities/permissions', () => ({ hasPermission: jest.fn() }));
jest.mock('../../models/mastodonSchedule', () => ({
  create: jest.fn(),
  find: jest.fn(),
  deleteOne: jest.fn(),
}));

const { hasPermission } = require('../../utilities/permissions');
const MastodonSchedule = require('../../models/mastodonSchedule');
const mastodonRouter = require('../mastodonRouter');

// Mirrors how the app mounts the router, with a stand-in for the auth
// middleware that normally puts the logged-in user on req.body.requestor.
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.body = { ...(req.body || {}), requestor: { requestorId: 'user-1', role: 'Administrator' } };
    next();
  });
  app.use('/api', mastodonRouter);
  return app;
};

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe('mastodonRouter', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    app = buildApp();
  });

  describe('permissions', () => {
    it('rejects people without the announcements permission', async () => {
      hasPermission.mockResolvedValue(false);

      const res = await request(app).get('/api/mastodon/schedule');

      expect(res.status).toBe(403);
      expect(hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({ requestorId: 'user-1' }),
        'sendEmails',
      );
      expect(MastodonSchedule.find).not.toHaveBeenCalled();
    });

    it('returns 500 and logs the error when the permission check fails', async () => {
      hasPermission.mockRejectedValue(new Error('database unavailable'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app).get('/api/mastodon/schedule');

      expect(res.status).toBe(500);
      expect(consoleError).toHaveBeenCalledWith(
        'Mastodon permission check failed:',
        'database unavailable',
      );
      expect(MastodonSchedule.find).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('lets people with the permission through', async () => {
      MastodonSchedule.find.mockResolvedValue([]);

      const res = await request(app).get('/api/mastodon/schedule');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /api/mastodon/schedule', () => {
    it('stores a valid scheduled post', async () => {
      MastodonSchedule.create.mockResolvedValue({});
      const scheduledTime = inOneHour();

      const res = await request(app)
        .post('/api/mastodon/schedule')
        .send({ description: '  Hello Mastodon  ', scheduledTime });

      expect(res.status).toBe(200);
      const saved = MastodonSchedule.create.mock.calls[0][0];
      expect(JSON.parse(saved.postData)).toEqual({
        status: 'Hello Mastodon',
        visibility: 'public',
      });
      expect(saved.scheduledTime.toISOString()).toBe(scheduledTime);
    });

    it.each([
      ['empty content', { description: '   ', scheduledTime: inOneHour() }],
      ['a missing time', { description: 'Hello' }],
      ['an invalid time', { description: 'Hello', scheduledTime: 'not-a-date' }],
      ['a time in the past', { description: 'Hello', scheduledTime: '2020-01-01T00:00:00Z' }],
    ])('rejects %s with 400', async (_label, body) => {
      const res = await request(app).post('/api/mastodon/schedule').send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
      expect(MastodonSchedule.create).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/mastodon/schedule/:id', () => {
    it('deletes an existing scheduled post', async () => {
      MastodonSchedule.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app).delete('/api/mastodon/schedule/abc123');

      expect(res.status).toBe(200);
      expect(MastodonSchedule.deleteOne).toHaveBeenCalledWith({
        _id: 'abc123',
        status: { $in: ['pending', null, 'failed'] },
      });
    });

    it('returns 404 when the post does not exist', async () => {
      MastodonSchedule.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const res = await request(app).delete('/api/mastodon/schedule/missing');

      expect(res.status).toBe(404);
    });
  });
});
