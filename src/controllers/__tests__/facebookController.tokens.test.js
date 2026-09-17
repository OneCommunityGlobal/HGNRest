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
  return MockScheduledFacebookPost;
});

jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const axios = require('axios');
const FacebookConnection = require('../../models/facebookConnections');
const ScheduledFacebookPost = require('../../models/scheduledFacebookPost');
const { hasPermission } = require('../../utilities/permissions');
const { getPostHistory, postToFacebook, scheduleFacebookPost } = require('../facebookController');

const PAGE_TOKEN = 'controller-page-token-secret';
const USER_TOKEN = 'controller-user-token-secret';
const USER = { requestorId: 'authorized-user', role: 'Owner' };

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

const expectNoTokenExposure = (value) => {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('pageAccessToken');
  expect(serialized).not.toContain('userAccessToken');
  expect(serialized).not.toContain(PAGE_TOKEN);
  expect(serialized).not.toContain(USER_TOKEN);
};

const makeHistoryQuery = (posts = []) => {
  const query = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(posts),
  };
  return query;
};

describe('facebookController token selection and exposure', () => {
  let consoleLog;
  let consoleError;
  let consoleWarn;

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    expectNoTokenExposure(consoleLog.mock.calls);
    expectNoTokenExposure(consoleError.mock.calls);
    expectNoTokenExposure(consoleWarn.mock.calls);
    consoleLog.mockRestore();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it('loads the page token for immediate posting without exposing it in the response', async () => {
    FacebookConnection.getActiveConnection.mockResolvedValue({
      pageId: '12345',
      pageName: 'One Community',
      pageAccessToken: PAGE_TOKEN,
      userAccessToken: USER_TOKEN,
    });
    axios.post.mockResolvedValue({ data: { id: 'facebook-post-id' } });
    const save = jest.fn().mockResolvedValue(undefined);
    ScheduledFacebookPost.mockImplementation((data) => ({ ...data, _id: 'history-id', save }));
    const res = makeResponse();

    await postToFacebook({ user: USER, body: { message: 'Token-safe post' } }, res);

    expect(FacebookConnection.getActiveConnection).toHaveBeenNthCalledWith(1, {
      includePageAccessToken: true,
    });
    expect(FacebookConnection.getActiveConnection).toHaveBeenNthCalledWith(2);
    expect(FacebookConnection.getActiveConnection).toHaveBeenNthCalledWith(3);
    expect(axios.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/12345/feed',
      expect.objectContaining({ access_token: PAGE_TOKEN, message: 'Token-safe post' }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expectNoTokenExposure(res.send.mock.calls);
  });

  it('independently loads the page token when validating schedule creation readiness', async () => {
    FacebookConnection.getActiveConnection.mockResolvedValue({
      pageId: '12345',
      pageName: 'One Community',
      pageAccessToken: PAGE_TOKEN,
      userAccessToken: USER_TOKEN,
    });
    const save = jest.fn().mockResolvedValue(undefined);
    ScheduledFacebookPost.mockImplementation((data) => ({ ...data, _id: 'scheduled-id', save }));
    const res = makeResponse();

    await scheduleFacebookPost(
      {
        user: USER,
        body: {
          message: 'Schedule safely',
          scheduledFor: '2099-01-01T12:00:00.000Z',
          timezone: 'UTC',
        },
      },
      res,
    );

    expect(FacebookConnection.getActiveConnection).toHaveBeenCalledWith({
      includePageAccessToken: true,
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expectNoTokenExposure(res.send.mock.calls);
  });

  it('keeps Mongo-only history on the default token-free connection lookup', async () => {
    FacebookConnection.getActiveConnection.mockResolvedValue({
      pageId: '12345',
      pageName: 'One Community',
      pageAccessToken: PAGE_TOKEN,
      userAccessToken: USER_TOKEN,
    });
    ScheduledFacebookPost.find.mockReturnValue(makeHistoryQuery([]));
    ScheduledFacebookPost.countDocuments.mockResolvedValue(0);
    const res = makeResponse();

    await getPostHistory({ user: USER, query: { source: 'mongodb' } }, res);

    expect(FacebookConnection.getActiveConnection).toHaveBeenCalledWith();
    expect(axios.get).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expectNoTokenExposure(res.send.mock.calls);
  });

  it('loads only the page token for Graph-backed history', async () => {
    FacebookConnection.getActiveConnection.mockResolvedValue({
      pageId: '12345',
      pageName: 'One Community',
      pageAccessToken: PAGE_TOKEN,
      userAccessToken: USER_TOKEN,
    });
    axios.get.mockResolvedValue({ data: { data: [] } });
    const res = makeResponse();

    await getPostHistory({ user: USER, query: { source: 'facebook' } }, res);

    expect(FacebookConnection.getActiveConnection).toHaveBeenCalledWith({
      includePageAccessToken: true,
    });
    expect(axios.get).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/12345/feed',
      expect.objectContaining({ params: expect.objectContaining({ access_token: PAGE_TOKEN }) }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expectNoTokenExposure(res.send.mock.calls);
  });
});
