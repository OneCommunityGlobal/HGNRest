jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
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

  it('independently reloads the page token when a scheduled post becomes due', async () => {
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
      userAccessToken: USER_TOKEN,
    });
    axios.post.mockResolvedValue({ data: { id: 'scheduled-facebook-post-id' } });
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
    await scheduledCallback();

    expect(FacebookConnection.getActiveConnection).toHaveBeenCalled();
    FacebookConnection.getActiveConnection.mock.calls.forEach((args) => {
      expect(args).toEqual([{ includePageAccessToken: true }]);
    });
    expect(axios.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/12345/feed',
      expect.objectContaining({ access_token: PAGE_TOKEN }),
    );
    expect(scheduledPost.status).toBe('sent');
    expect(scheduledPost.save).toHaveBeenCalledTimes(1);
    expect(logger.logException).not.toHaveBeenCalled();
    expectNoTokenExposure(consoleLog.mock.calls);
    expectNoTokenExposure(consoleError.mock.calls);
    expectNoTokenExposure(logger.logException.mock.calls);

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
});
