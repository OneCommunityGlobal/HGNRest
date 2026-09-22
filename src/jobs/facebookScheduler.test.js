jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  request: jest.fn(),
}));

jest.mock('../models/facebookConnections', () => ({
  getActiveConnection: jest.fn(),
}));

jest.mock('../models/scheduledFacebookPost', () => ({
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../startup/logger', () => ({
  logException: jest.fn(),
}));

const cron = require('node-cron');
const axios = require('axios');
const FacebookConnection = require('../models/facebookConnections');
const ScheduledFacebookPost = require('../models/scheduledFacebookPost');
const logger = require('../startup/logger');
const startFacebookScheduler = require('./facebookScheduler');

const PAGE_TOKEN = 'scheduler-page-token-secret';
const USER_TOKEN = 'scheduler-user-token-secret';
const UNSAFE_PAGE_IDS = [
  'https://169.254.169.254/latest/meta-data/',
  'http://localhost:3000',
  '//evil.example',
  '12345/../../admin',
  '12345?x=https://evil.example',
  '12345#fragment',
];

const expectNoTokenExposure = (value) => {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('pageAccessToken');
  expect(serialized).not.toContain('userAccessToken');
  expect(serialized).not.toContain(PAGE_TOKEN);
  expect(serialized).not.toContain(USER_TOKEN);
};

describe('facebookScheduler token selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses one Page A snapshot through validation and Axios even if a later lookup is Page B', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let scheduledCallback;
    cron.schedule.mockImplementation((expression, callback) => {
      scheduledCallback = callback;
    });
    const pageACredentials = {
      pageId: 12345,
      pageName: 'One Community',
      pageAccessToken: PAGE_TOKEN,
      userAccessToken: USER_TOKEN,
    };
    const pageBCredentials = {
      pageId: '99999',
      pageName: 'Other Page',
      pageAccessToken: 'other-page-token',
    };
    FacebookConnection.getActiveConnection.mockResolvedValue(pageACredentials);
    const scheduledPost = {
      _id: 'scheduled-post-id',
      message: 'Scheduled message',
      pageId: '12345',
      attempts: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const firstQuery = { exec: jest.fn().mockResolvedValue(scheduledPost) };
    const emptyQuery = { exec: jest.fn().mockResolvedValue(null) };
    ScheduledFacebookPost.findOneAndUpdate
      .mockReturnValueOnce(firstQuery)
      .mockReturnValueOnce(emptyQuery);

    startFacebookScheduler();
    await Promise.resolve();
    FacebookConnection.getActiveConnection.mockClear();
    FacebookConnection.getActiveConnection
      .mockResolvedValueOnce(pageACredentials)
      .mockResolvedValue(pageBCredentials);
    axios.request.mockImplementation(async ({ url, data }) => {
      expect(FacebookConnection.getActiveConnection).toHaveBeenCalledTimes(1);
      expect(url).toBe('https://graph.facebook.com/v19.0/12345/feed');
      expect(data).toEqual(expect.objectContaining({ access_token: PAGE_TOKEN }));
      return { data: { id: 'scheduled-facebook-post-id' } };
    });
    await scheduledCallback();

    expect(FacebookConnection.getActiveConnection).toHaveBeenCalledTimes(2);
    FacebookConnection.getActiveConnection.mock.calls.forEach((args) => {
      expect(args).toEqual([{ includePageAccessToken: true }]);
    });
    expect(axios.request).toHaveBeenCalledWith({
      method: 'post',
      url: 'https://graph.facebook.com/v19.0/12345/feed',
      data: expect.objectContaining({ access_token: PAGE_TOKEN }),
    });
    expect(scheduledPost.status).toBe('sent');
    expect(scheduledPost.save).toHaveBeenCalledTimes(1);
    expect(logger.logException).not.toHaveBeenCalled();
    expectNoTokenExposure(consoleLog.mock.calls);
    expectNoTokenExposure(consoleError.mock.calls);
    expectNoTokenExposure(logger.logException.mock.calls);

    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it('creates a fresh credential snapshot for each scheduled post in the processing loop', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let scheduledCallback;
    cron.schedule.mockImplementation((expression, callback) => {
      scheduledCallback = callback;
    });
    const pageACredentials = {
      pageId: '12345',
      pageName: 'One Community',
      pageAccessToken: PAGE_TOKEN,
    };
    const pageBCredentials = {
      pageId: '99999',
      pageName: 'Other Page',
      pageAccessToken: 'other-page-token',
    };
    FacebookConnection.getActiveConnection.mockResolvedValue(pageACredentials);
    axios.request.mockResolvedValueOnce({ data: { id: 'page-a-post' } }).mockResolvedValueOnce({
      data: { id: 'page-b-post' },
    });
    const pageAPost = {
      _id: 'page-a-scheduled-post',
      message: 'Page A message',
      pageId: '12345',
      attempts: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const pageBPost = {
      _id: 'page-b-scheduled-post',
      message: 'Page B message',
      pageId: '99999',
      attempts: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };
    ScheduledFacebookPost.findOneAndUpdate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(pageAPost) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(pageBPost) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });

    startFacebookScheduler();
    await Promise.resolve();
    FacebookConnection.getActiveConnection.mockClear();
    FacebookConnection.getActiveConnection
      .mockResolvedValueOnce(pageACredentials)
      .mockResolvedValueOnce(pageBCredentials)
      .mockResolvedValue(pageBCredentials);
    await scheduledCallback();

    expect(axios.request).toHaveBeenNthCalledWith(1, {
      method: 'post',
      url: 'https://graph.facebook.com/v19.0/12345/feed',
      data: expect.objectContaining({ access_token: PAGE_TOKEN }),
    });
    expect(axios.request).toHaveBeenNthCalledWith(2, {
      method: 'post',
      url: 'https://graph.facebook.com/v19.0/99999/feed',
      data: expect.objectContaining({ access_token: 'other-page-token' }),
    });
    expect(pageAPost.status).toBe('sent');
    expect(pageBPost.status).toBe('sent');

    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it('does not let a stale stored pageId alter the connected Graph destination', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let scheduledCallback;
    cron.schedule.mockImplementation((expression, callback) => {
      scheduledCallback = callback;
    });
    FacebookConnection.getActiveConnection.mockResolvedValue({
      pageId: '12345',
      pageName: 'One Community',
      pageAccessToken: PAGE_TOKEN,
    });
    const scheduledPost = {
      _id: 'scheduled-post-id',
      message: 'Scheduled message',
      pageId: '99999',
      attempts: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };
    ScheduledFacebookPost.findOneAndUpdate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(scheduledPost) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });

    startFacebookScheduler();
    await Promise.resolve();
    await scheduledCallback();

    expect(axios.request).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(scheduledPost.status).toBe('pending');
    expect(scheduledPost.attempts).toBe(1);
    expect(scheduledPost.lastError).toBe(
      'Requested Facebook Page ID does not match the connected Page.',
    );
    expect(scheduledPost.save).toHaveBeenCalledTimes(1);
    expect(logger.logException).toHaveBeenCalledWith(
      expect.any(Error),
      'facebookScheduler.process',
      expect.objectContaining({ scheduledId: 'scheduled-post-id' }),
    );

    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it.each(UNSAFE_PAGE_IDS)('rejects invalid scheduled pageId %p before Axios', async (pageId) => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let scheduledCallback;
    cron.schedule.mockImplementation((expression, callback) => {
      scheduledCallback = callback;
    });
    FacebookConnection.getActiveConnection.mockResolvedValue({
      pageId: '12345',
      pageName: 'One Community',
      pageAccessToken: PAGE_TOKEN,
    });
    const scheduledPost = {
      _id: 'scheduled-post-id',
      message: 'Scheduled message',
      pageId,
      attempts: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };
    ScheduledFacebookPost.findOneAndUpdate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(scheduledPost) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });

    startFacebookScheduler();
    await Promise.resolve();
    await scheduledCallback();

    expect(axios.request).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(scheduledPost.status).toBe('pending');
    expect(scheduledPost.attempts).toBe(1);
    expect(scheduledPost.lastError).toBe('Invalid Facebook Page ID format. Must be numeric.');
    expect(scheduledPost.save).toHaveBeenCalledTimes(1);

    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it('leaves a due post unclaimed when credentials are unavailable', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let scheduledCallback;
    cron.schedule.mockImplementation((expression, callback) => {
      scheduledCallback = callback;
    });
    FacebookConnection.getActiveConnection.mockResolvedValue(null);

    startFacebookScheduler();
    await Promise.resolve();
    await scheduledCallback();

    expect(ScheduledFacebookPost.findOneAndUpdate).not.toHaveBeenCalled();
    expect(axios.request).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();

    consoleLog.mockRestore();
    consoleError.mockRestore();
  });
});
