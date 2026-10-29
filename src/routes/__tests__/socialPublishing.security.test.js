const express = require('express');
const request = require('supertest');
jest.mock('axios');
jest.mock('node-schedule', () => ({ scheduleJob: jest.fn(() => ({ cancel: jest.fn() })) }));
jest.mock('../../utilities/permissions', () => ({ hasPermission: jest.fn() }));
jest.mock('../../models/mastodonSchedule', () => ({
  create: jest.fn(),
  find: jest.fn(),
  deleteOne: jest.fn(),
}));

const axios = require('axios');
const schedule = require('node-schedule');
const { hasPermission } = require('../../utilities/permissions');
const mastodonRouter = require('../mastodonRouter');
const linkedinRoutes = require('../linkedinPostRoutes');
const MastodonSchedule = require('../../models/mastodonSchedule');

function buildApp(user) {
  const app = express();
  app.use(express.json());
  // Stand-in for the identity attached by the verified-JWT middleware; body fields are untrusted.
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api', mastodonRouter);
  app.use('/api', linkedinRoutes());
  return app;
}

describe('publishing credentials stay behind the API boundary', () => {
  const original = { ...process.env };
  const user = { requestorId: 'publisher', role: 'Administrator' };
  let app;
  let errorLog;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MASTODON_ACCESS_TOKEN = 'MASTODON_PRIVATE_SENTINEL';
    process.env.MASTODON_ENDPOINT = 'https://mastodon.example';
    process.env.LINKEDIN_ACCESS_TOKEN = 'LINKEDIN_PRIVATE_SENTINEL';
    process.env.ORGANIZATION_URN = 'urn:li:organization:123';
    hasPermission.mockResolvedValue(true);
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    app = buildApp(user);
  });
  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });

  it.each([
    ['post', '/api/mastodon/createPin'],
    ['post', '/api/mastodon/schedule'],
    ['get', '/api/mastodon/schedule'],
    ['delete', '/api/mastodon/schedule/123'],
    ['get', '/api/mastodon/history'],
    ['post', '/api/postToLinkedIn'],
    ['get', '/api/scheduledPosts'],
    ['put', '/api/scheduledPosts/123'],
    ['delete', '/api/scheduledPosts/123'],
  ])('blocks an unprivileged caller on %s %s', async (method, url) => {
    hasPermission.mockResolvedValue(false);
    const res = await request(app)
      [method](url)
      .send({ content: 'post', requestor: { requestorId: 'owner', role: 'Owner' } });
    expect(res.status).toBe(403);
    expect(hasPermission).toHaveBeenCalledWith(user, 'sendEmails');
    expect(axios.post).not.toHaveBeenCalled();
    expect(schedule.scheduleJob).not.toHaveBeenCalled();
    expect(MastodonSchedule.create).not.toHaveBeenCalled();
  });

  it('does not accept a forged body identity when no verified identity exists', async () => {
    const res = await request(buildApp(null))
      .post('/api/postToLinkedIn')
      .send({ content: 'post', requestor: { requestorId: 'owner', role: 'Owner' } });
    expect(res.status).toBe(401);
    expect(hasPermission).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('fails closed without revealing permission-service errors', async () => {
    hasPermission.mockRejectedValue(new Error('LINKEDIN_PRIVATE_SENTINEL'));
    const res = await request(app).get('/api/scheduledPosts');
    expect(res.status).toBe(500);
    expect(JSON.stringify([res.body, errorLog.mock.calls])).not.toContain('PRIVATE_SENTINEL');
  });

  it.each([
    [
      '/api/mastodon/createPin',
      { description: 'hello', accessToken: 'CLIENT_OVERRIDE' },
      'MASTODON_PRIVATE_SENTINEL',
    ],
    [
      '/api/postToLinkedIn',
      { content: 'hello', accessToken: 'CLIENT_OVERRIDE' },
      'LINKEDIN_PRIVATE_SENTINEL',
    ],
  ])(
    'uses the server token and strips provider response credentials for %s',
    async (url, body, token) => {
      axios.post.mockResolvedValue({
        data: {
          id: '123',
          url: 'https://mastodon.example/@user/123',
          accessToken: token,
          config: { Authorization: token },
        },
      });
      const res = await request(app).post(url).send(body);
      expect(res.status).toBe(200);
      expect(axios.post.mock.calls[0][2]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
          maxRedirects: 0,
        }),
      );
      expect(JSON.stringify([res.body, errorLog.mock.calls])).not.toMatch(
        /PRIVATE_SENTINEL|CLIENT_OVERRIDE/,
      );
    },
  );

  it.each([
    ['/api/mastodon/createPin', { description: 'hello' }],
    ['/api/postToLinkedIn', { content: 'hello' }],
  ])('does not expose provider error bodies, messages or headers for %s', async (url, body) => {
    const error = Object.assign(new Error('LINKEDIN_PRIVATE_SENTINEL'), {
      response: {
        status: 401,
        data: { error: 'MASTODON_PRIVATE_SENTINEL', message: 'LINKEDIN_PRIVATE_SENTINEL' },
      },
      config: { headers: { Authorization: 'LINKEDIN_PRIVATE_SENTINEL' } },
    });
    axios.post.mockRejectedValue(error);
    const res = await request(app).post(url).send(body);
    expect(res.status).toBe(401);
    expect(JSON.stringify([res.body, errorLog.mock.calls])).not.toContain('PRIVATE_SENTINEL');
  });

  it.each([
    ['/api/mastodon/createPin', { description: 'hello' }, 'MASTODON_ACCESS_TOKEN'],
    ['/api/postToLinkedIn', { content: 'hello' }, 'LINKEDIN_ACCESS_TOKEN'],
  ])('fails closed when the server token is absent for %s', async (url, body, name) => {
    delete process.env[name];
    const res = await request(app).post(url).send(body);
    expect(res.status).toBe(503);
    expect(axios.post).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain(name);
  });

  it('scheduled LinkedIn delivery uses a rotated token, never listing it', async () => {
    const res = await request(app)
      .post('/api/postToLinkedIn')
      .send({ content: 'scheduled', scheduleTime: new Date(Date.now() + 60000).toISOString() });
    expect(res.status).toBe(200);
    const list = await request(app).get('/api/scheduledPosts');
    expect(JSON.stringify([res.body, list.body])).not.toContain('PRIVATE_SENTINEL');
    process.env.LINKEDIN_ACCESS_TOKEN = 'ROTATED_PRIVATE_SENTINEL';
    axios.post.mockResolvedValue({ data: { id: '123' } });
    await schedule.scheduleJob.mock.calls[0][1]();
    expect(axios.post.mock.calls[0][2].headers.Authorization).toBe(
      'Bearer ROTATED_PRIVATE_SENTINEL',
    );
    expect((await request(app).get('/api/scheduledPosts')).body.scheduledPosts).toEqual([]);
  });

  it('does not expose a historic stored provider error when listing Mastodon schedules', async () => {
    MastodonSchedule.find.mockResolvedValue([
      { _id: '123', status: 'failed', lastError: 'Bearer MASTODON_PRIVATE_SENTINEL' },
    ]);
    const res = await request(app).get('/api/mastodon/schedule');
    expect(res.status).toBe(200);
    expect(res.body[0].lastError).toContain('Mastodon delivery failed');
    expect(JSON.stringify(res.body)).not.toContain('PRIVATE_SENTINEL');
  });

  it('does not echo Mastodon history errors or media upload errors to responses/logs', async () => {
    const error = Object.assign(new Error('Bearer MASTODON_PRIVATE_SENTINEL'), {
      response: { status: 503, data: { error: 'MASTODON_PRIVATE_SENTINEL' } },
    });
    axios.get.mockRejectedValue(error);
    const history = await request(app).get('/api/mastodon/history');
    expect(history.status).toBe(503);
    axios.post.mockRejectedValue(error);
    const post = await request(app).post('/api/mastodon/createPin').send({
      description: 'image post',
      imgType: 'FILE',
      mediaItems: 'data:image/png;base64,YQ==',
      mediaAltText: 'example',
    });
    expect(post.status).toBe(503);
    expect(JSON.stringify([history.body, post.body, errorLog.mock.calls])).not.toContain(
      'PRIVATE_SENTINEL',
    );
  });

  it('authorizes multipart LinkedIn requests before reading the uploaded body', async () => {
    hasPermission.mockResolvedValue(false);
    const res = await request(app)
      .post('/api/postToLinkedIn')
      .field('requestor', JSON.stringify({ requestorId: 'owner', role: 'Owner' }))
      .attach('media', Buffer.from('not-really-an-image'), 'example.png');
    expect(res.status).toBe(403);
    expect(hasPermission).toHaveBeenCalledWith(user, 'sendEmails');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each([
    'http://upload.linkedin.com/file',
    'https://upload.linkedin.com.attacker.example/file',
    'https://user:password@upload.linkedin.com/file',
    'https://upload.linkedin.com:8443/file',
    'https://attacker.example/file',
    'not-a-url',
  ])('never forwards a server credential to an unsafe upload destination %s', async (uploadUrl) => {
    axios.post.mockResolvedValueOnce({
      data: {
        value: {
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': { uploadUrl },
          },
          asset: 'urn:li:digitalmediaAsset:123',
        },
      },
    });
    const res = await request(app)
      .post('/api/postToLinkedIn')
      .field('content', 'image post')
      .attach('media', Buffer.from('bytes'), { filename: 'test.png', contentType: 'image/png' });
    expect(res.status).toBe(500);
    expect(axios.put).not.toHaveBeenCalled();
    expect(JSON.stringify([res.body, errorLog.mock.calls])).not.toContain('PRIVATE_SENTINEL');
  });

  it('uploads media only to a trusted HTTPS LinkedIn host, with redirects disabled', async () => {
    axios.post
      .mockResolvedValueOnce({
        data: {
          value: {
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://upload.linkedin.com/file',
              },
            },
            asset: 'urn:li:digitalmediaAsset:123',
          },
        },
      })
      .mockResolvedValueOnce({ data: { id: '123' } });
    axios.put.mockResolvedValue({ data: {} });
    const res = await request(app)
      .post('/api/postToLinkedIn')
      .field('content', 'image post')
      .attach('media', Buffer.from('bytes'), { filename: 'test.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.put).toHaveBeenCalledTimes(1);
    for (const call of [...axios.post.mock.calls, ...axios.put.mock.calls]) {
      expect(call[2].maxRedirects).toBe(0);
      expect(call[2].headers.Authorization).toBe('Bearer LINKEDIN_PRIVATE_SENTINEL');
    }
    expect(JSON.stringify(res.body)).not.toContain('PRIVATE_SENTINEL');
  });

  it('does not reveal scheduled LinkedIn delivery failures', async () => {
    await request(app)
      .post('/api/postToLinkedIn')
      .send({ content: 'scheduled', scheduleTime: new Date(Date.now() + 60000).toISOString() });
    axios.post.mockRejectedValue(
      Object.assign(new Error('LINKEDIN_PRIVATE_SENTINEL'), {
        response: { status: 401, data: { token: 'LINKEDIN_PRIVATE_SENTINEL' } },
      }),
    );
    await schedule.scheduleJob.mock.calls[0][1]();
    const list = await request(app).get('/api/scheduledPosts');
    expect(JSON.stringify([list.body, errorLog.mock.calls])).not.toContain('PRIVATE_SENTINEL');
  });

  it('does not send an existing scheduled LinkedIn post to a different organization after reconfiguration', async () => {
    const res = await request(app)
      .post('/api/postToLinkedIn')
      .send({ content: 'scheduled', scheduleTime: new Date(Date.now() + 60000).toISOString() });
    process.env.ORGANIZATION_URN = 'urn:li:organization:999';
    await schedule.scheduleJob.mock.calls[0][1]();
    expect(axios.post).not.toHaveBeenCalled();
    const update = await request(app)
      .put(`/api/scheduledPosts/${res.body.jobId}`)
      .send({ content: 'updated' });
    expect(update.status).toBe(503);
    expect(schedule.scheduleJob.mock.results[0].value.cancel).not.toHaveBeenCalled();
  });
});
