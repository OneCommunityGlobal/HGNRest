/* eslint-disable import/order, import/newline-after-import */
const fs = require('fs');
const express = require('express');
const request = require('supertest');

const makeHandler = () => jest.fn((_req, res) => res.sendStatus(204));

const mockXController = {
  createPost: makeHandler(),
  schedulePost: makeHandler(),
  getScheduled: makeHandler(),
  deleteScheduled: makeHandler(),
  updateScheduledPost: makeHandler(),
  markAsPosted: makeHandler(),
  skipPost: makeHandler(),
  getHistory: makeHandler(),
};
const mockMastodonController = {
  createPin: makeHandler(),
  schedulePin: makeHandler(),
  fetchScheduledPin: makeHandler(),
  deletedScheduledPin: makeHandler(),
  fetchPostHistory: makeHandler(),
};

jest.mock('../controllers/xPostController', () => mockXController);
jest.mock('../controllers/mastodonPostController', () => mockMastodonController);

const xRouter = require('./xRouter');
const mastodonRouter = require('./mastodonRouter');

describe('social-media startup route registration', () => {
  const source = fs.readFileSync(require.resolve('../startup/routes'), 'utf8');

  test('imports and mounts the X and Mastodon routers under the public API prefix', () => {
    expect(source).toMatch(
      /const\s+xRouter\s*=\s*require\(\s*['"]\.\.\/routes\/xRouter['"]\s*\)\s*;/,
    );
    expect(source).toMatch(
      /const\s+mastodonRouter\s*=\s*require\(\s*['"]\.\.\/routes\/mastodonRouter['"]\s*\)\s*;/,
    );
    expect(source).toMatch(/app\.use\(\s*['"]\/api\/x['"]\s*,\s*xRouter\s*\)/);
    expect(source).toMatch(/app\.use\(\s*['"]\/api['"]\s*,\s*mastodonRouter\s*\)/);
  });

  test('does not expose the legacy X mount or startup log', () => {
    expect(source).not.toMatch(/app\.use\(\s*['"]\/x['"]\s*,\s*xRouter\s*\)/);
    expect(source).not.toContain("console.log('X router mounted')");
  });
});

describe('social-media public route composition', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/x', xRouter);
  app.use('/api', mastodonRouter);

  beforeEach(() => jest.clearAllMocks());

  const routes = [
    ['post', '/api/x/post', mockXController.createPost],
    ['post', '/api/x/schedule', mockXController.schedulePost],
    ['get', '/api/x/schedule', mockXController.getScheduled],
    ['delete', '/api/x/schedule/post-id', mockXController.deleteScheduled],
    ['put', '/api/x/schedule/post-id', mockXController.updateScheduledPost],
    ['patch', '/api/x/schedule/post-id/mark-posted', mockXController.markAsPosted],
    ['patch', '/api/x/schedule/post-id/skip', mockXController.skipPost],
    ['get', '/api/x/history', mockXController.getHistory],
    ['post', '/api/mastodon/createPin', mockMastodonController.createPin],
    ['post', '/api/mastodon/schedule', mockMastodonController.schedulePin],
    ['get', '/api/mastodon/schedule', mockMastodonController.fetchScheduledPin],
    ['delete', '/api/mastodon/schedule/post-id', mockMastodonController.deletedScheduledPin],
    ['get', '/api/mastodon/history', mockMastodonController.fetchPostHistory],
  ];

  test.each(routes)('%s %s reaches its controller', async (method, path, controller) => {
    const response = await request(app)[method](path).send({ content: 'test' });

    expect(response.status).toBe(204);
    expect(controller).toHaveBeenCalledTimes(1);
  });

  test('does not expose /x as an alternate mount', async () => {
    const response = await request(app).get('/x/history');

    expect(response.status).toBe(404);
    expect(mockXController.getHistory).not.toHaveBeenCalled();
  });
});
