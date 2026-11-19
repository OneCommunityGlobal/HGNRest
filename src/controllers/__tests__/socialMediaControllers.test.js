const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../models/pinterestSchedule', () =>
  Object.assign(jest.fn(), { find: jest.fn(), deleteOne: jest.fn() }),
);

const PROD = 'https://api.pinterest.com/v5';
const SANDBOX = 'https://api-sandbox.pinterest.com/v5';
const BASIC = `Basic ${Buffer.from('app-id:app-secret').toString('base64')}`;
const HOUR = 3600 * 1000;
const TOKEN_FILE = 'access_token.txt';
const BOARDS = { data: { items: [{ id: 'b1', name: 'OneCommunity' }] } };
const URL_BODY = {
  imgType: 'URL',
  mediaItems: { url: 'https://img.test/a.png' },
  description: 'desc',
  title: 'title',
};

// The endpoint is chosen at import time, so load a fresh module (and fresh mocks) per env.
const load = () => {
  let m;
  jest.isolateModules(() => {
    m = {
      c: require('../socialMediaControllers'),
      axios: require('axios'),
      Model: require('../../models/pinterestSchedule'),
    };
  });
  return m;
};

const mockRes = () => {
  const res = { redirect: jest.fn() };
  ['status', 'json', 'send'].forEach((k) => {
    res[k] = jest.fn().mockReturnValue(res);
  });
  return res;
};

describe('socialMediaControllers (Pinterest)', () => {
  const ORIGINAL_ENV = process.env;
  let c;
  let axios;
  let Model;
  let errorSpy;
  let tmpDir;
  let originalCwd;

  const setToken = (offset) =>
    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify({ accessToken: 'tok', refreshToken: 'ref', expireTime: Date.now() + offset }),
    );
  const readToken = () => JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  const pinPost = () => axios.post.mock.calls.find(([url]) => url.endsWith('/pins'));

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinterest-test-'));
    process.chdir(tmpDir);
    process.env = {
      ...ORIGINAL_ENV,
      PINTEREST_APP_ID: 'app-id',
      PINTEREST_APP_SECRET: 'app-secret',
      PINTEREST_REDIRECT_URI: 'https://example.com/cb',
    };
    delete process.env.PINTEREST_SANDBOX_API;
    ({ c, axios, Model } = load());
    setToken(HOUR); // default: valid token on disk
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    process.env = ORIGINAL_ENV;
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initiatePinterestAuth redirects to Pinterest with the right params', () => {
    const res = mockRes();
    c.initiatePinterestAuth({}, res);

    const url = new URL(res.redirect.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://www.pinterest.com/oauth/');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'app-id',
      redirect_uri: 'https://example.com/cb',
      response_type: 'code',
      scope: 'pins:read,pins:write,boards:read,boards:write,users:read',
    });
  });

  describe('handlePinterestCallback', () => {
    it('returns 400 without a code', async () => {
      const res = mockRes();
      await c.handlePinterestCallback({ query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('exchanges the code and stores the token', async () => {
      axios.post.mockResolvedValue({
        data: { access_token: 'a', refresh_token: 'r', expires_in: 3600 },
      });
      const res = mockRes();
      const before = Date.now();

      await c.handlePinterestCallback({ query: { code: 'xyz' } }, res);

      const [url, body, { headers }] = axios.post.mock.calls[0];
      expect(url).toBe(`${PROD}/oauth/token`);
      expect(Object.fromEntries(new URLSearchParams(body))).toEqual({
        grant_type: 'authorization_code',
        code: 'xyz',
        redirect_uri: 'https://example.com/cb',
      });
      expect(headers.Authorization).toBe(BASIC);

      const saved = readToken();
      expect(saved).toMatchObject({ accessToken: 'a', refreshToken: 'r' });
      expect(saved.expireTime).toBeGreaterThanOrEqual(before + HOUR);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 500 when the exchange fails', async () => {
      axios.post.mockRejectedValue(new Error('invalid_grant'));
      const res = mockRes();
      await c.handlePinterestCallback({ query: { code: 'bad' } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'invalid_grant' });
    });
  });

  describe('access tokens (via fetchBoardList)', () => {
    beforeEach(() => axios.get.mockResolvedValue({ data: { items: ['board'] } }));

    it('uses a valid token from disk', async () => {
      expect(await c.fetchBoardList()).toEqual(['board']);
      expect(axios.get).toHaveBeenCalledWith(`${PROD}/boards`, {
        headers: { Authorization: 'Bearer tok' },
        responseType: 'json',
      });
    });

    it('refreshes an expired token and saves it', async () => {
      setToken(-HOUR);
      axios.post.mockResolvedValue({ data: { access_token: 'fresh', expires_in: 7200 } });

      await c.fetchBoardList();

      const [, body, { headers }] = axios.post.mock.calls[0];
      expect(Object.fromEntries(new URLSearchParams(body))).toEqual({
        grant_type: 'refresh_token',
        refresh_token: 'ref',
      });
      expect(headers.Authorization).toBe(BASIC);
      expect(readToken()).toMatchObject({
        accessToken: 'fresh',
        refreshToken: 'ref', // kept
      });
      expect(axios.get.mock.calls[0][1].headers.Authorization).toBe('Bearer fresh');
    });

    it.each([
      [
        'the refresh fails',
        () => {
          setToken(-HOUR);
          axios.post.mockRejectedValue(new Error('denied'));
        },
      ],
      ['the token file is missing', () => fs.rmSync(TOKEN_FILE)],
    ])('throws a re-authenticate error when %s', async (_name, setup) => {
      setup();

      await expect(c.fetchBoardList()).rejects.toThrow(/re-authenticate/);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('uses the sandbox endpoint and token without needing a token file', async () => {
      fs.rmSync(TOKEN_FILE);
      process.env.PINTEREST_SANDBOX_API = 'true';
      process.env.PINTEREST_SANDBOX_API_TOKEN = 'sandbox-tok';
      ({ c, axios } = load());
      axios.get.mockResolvedValue({ data: { items: [] } });

      await c.fetchBoardList();

      expect(axios.get).toHaveBeenCalledWith(`${SANDBOX}/boards`, {
        headers: { Authorization: 'Bearer sandbox-tok' },
        responseType: 'json',
      });
    });
  });

  it('postPinImmediately posts to /pins and returns the response', async () => {
    const response = { data: { id: 'pin-1' } };
    axios.post.mockResolvedValue(response);

    expect(await c.postPinImmediately({ title: 'T' })).toBe(response);
    expect(axios.post).toHaveBeenCalledWith(
      `${PROD}/pins`,
      { title: 'T' },
      { headers: { Authorization: 'Bearer tok' }, responseType: 'json' },
    );
  });

  describe('createPin (covers getPostData and createBoard)', () => {
    it('posts a URL-image pin to the existing board', async () => {
      axios.get.mockResolvedValue(BOARDS);
      axios.post.mockResolvedValue({ data: { id: 'pin-1' } });
      const res = mockRes();

      await c.createPin({ body: URL_BODY }, res);

      expect(axios.post).toHaveBeenCalledTimes(1); // no board creation
      expect(pinPost()[1]).toEqual({
        board_id: 'b1',
        description: 'desc',
        title: 'title',
        media_source: { source_type: 'image_url', url: 'https://img.test/a.png' },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: 'pin-1' });
    });

    it('creates the OneCommunity board when it is missing', async () => {
      axios.get.mockResolvedValue({ data: { items: [{ id: 'x', name: 'Other' }] } });
      axios.post
        .mockResolvedValueOnce({ data: { id: 'new-board' } })
        .mockResolvedValueOnce({ data: { id: 'pin-2' } });

      await c.createPin({ body: URL_BODY }, mockRes());

      expect(axios.post.mock.calls[0].slice(0, 2)).toEqual([
        `${PROD}/boards`,
        { name: 'OneCommunity', description: 'Updates from One Community', privacy: 'PUBLIC' },
      ]);
      expect(pinPost()[1].board_id).toBe('new-board');
    });

    it('turns an uploaded file (data URL) into a base64 media source', async () => {
      axios.get.mockResolvedValue(BOARDS);
      axios.post.mockResolvedValue({ data: {} });

      await c.createPin(
        { body: { ...URL_BODY, imgType: 'FILE', mediaItems: 'data:image/png;base64, AAAA ' } },
        mockRes(),
      );

      expect(pinPost()[1].media_source).toEqual({
        source_type: 'image_base64',
        content_type: 'image/png',
        data: 'AAAA',
      });
    });

    it.each([
      [
        'a Pinterest API error',
        Object.assign(new Error('x'), {
          response: { status: 429, data: { message: 'Slow down' } },
        }),
        { message: 'Slow down' },
        429,
        'Slow down',
      ],
      ['a generic error', new Error('network down'), 'network down', 500, 'network down'],
      ['an error with no message', new Error(''), '', 500, 'Failed to create Pinterest pin'],
    ])('handles %s', async (_name, error, logged, status, message) => {
      axios.get.mockRejectedValue(error);
      const res = mockRes();

      await c.createPin({ body: URL_BODY }, res);

      expect(errorSpy).toHaveBeenCalledWith('Error creating Pinterest pin:', logged);
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({ error: message });
    });
  });

  describe('schedulePin', () => {
    const body = { ...URL_BODY, scheduledTime: '2030-01-01T10:00:00.000Z' };

    it('saves the serialized pin with its scheduled time', async () => {
      axios.get.mockResolvedValue(BOARDS);
      const save = jest.fn().mockResolvedValue();
      Model.mockImplementation(function () {
        this.save = save;
      });
      const res = mockRes();

      await c.schedulePin({ body }, res);

      const { postData, scheduledTime } = Model.mock.calls[0][0];
      expect(scheduledTime).toBe(body.scheduledTime);
      expect(JSON.parse(postData)).toMatchObject({ board_id: 'b1', title: 'title' });
      expect(save).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it.each(['saving', 'loading boards'])('returns 500 and logs when %s fails', async (stage) => {
      const err = new Error('boom');
      axios.get.mockResolvedValue(BOARDS);
      if (stage === 'saving') {
        Model.mockImplementation(function () {
          this.save = jest.fn().mockRejectedValue(err);
        });
      } else {
        axios.get.mockRejectedValue(err);
      }
      const res = mockRes();

      await c.schedulePin({ body }, res);

      expect(errorSpy).toHaveBeenCalledWith('Error scheduling Pinterest pin:', err);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('scheduled pin CRUD', () => {
    it('fetchScheduledPin returns all pins', async () => {
      Model.find.mockResolvedValue([{ _id: '1' }]);
      const res = mockRes();
      await c.fetchScheduledPin({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ _id: '1' }]);
    });

    it('deletedScheduledPin deletes by id', async () => {
      Model.deleteOne.mockResolvedValue({});
      const res = mockRes();
      await c.deletedScheduledPin({ params: { id: 'abc' } }, res);

      expect(Model.deleteOne).toHaveBeenCalledWith({ _id: 'abc' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it.each([
      [
        'fetchScheduledPin',
        'find',
        {},
        'Error fetching scheduled pins:',
        'Failed to fetch scheduled pins',
      ],
      [
        'deletedScheduledPin',
        'deleteOne',
        { params: { id: 'abc' } },
        'Error deleting scheduled pin:',
        'Failed to deleted scheduled pin post!',
      ],
    ])('%s returns 500 and logs on failure', async (fn, modelMethod, req, logMsg, sendMsg) => {
      const err = new Error('db error');
      Model[modelMethod].mockRejectedValue(err);
      const res = mockRes();

      await c[fn](req, res);

      expect(errorSpy).toHaveBeenCalledWith(logMsg, err);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(sendMsg);
    });
  });
});
