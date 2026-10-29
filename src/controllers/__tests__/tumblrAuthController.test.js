jest.mock('../../models/tumblrConnection', () => {
  const TumblrConnection = jest.fn(function (doc) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
  });
  TumblrConnection.findOne = jest.fn();
  TumblrConnection.updateOne = jest.fn().mockResolvedValue({});
  TumblrConnection.deleteOne = jest.fn().mockResolvedValue({});
  return {
    TumblrConnection,
    encrypt: (v) => `enc(${v})`,
    decrypt: (v) => String(v).replace(/^enc\((.*)\)$/, '$1'),
  };
});

const { TumblrConnection } = require('../../models/tumblrConnection');
const ctrl = require('../tumblrAuthController');

const { TumblrError, getUserId, sendError, getValidToken, markNeedsReauth } = ctrl;

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

const jsonResponse = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const makeConnection = (overrides = {}) => ({
  userId: 'u1',
  accessTokenEnc: 'enc(old-access)',
  refreshTokenEnc: 'enc(old-refresh)',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  needsReauth: false,
  tumblrUsername: 'alice',
  blogs: [{ name: 'blog1', title: 'Blog One', uuid: 't1' }],
  blogsUpdatedAt: new Date(),
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const userInfoBody = {
  response: {
    user: { name: 'alice', blogs: [{ name: 'new', title: 'New', uuid: 'x1' }] },
  },
};

async function runStart(userId = 'u1') {
  const res = makeRes();
  await ctrl.start({ user: { id: userId } }, res);
  const { url } = res.json.mock.calls[0][0];
  const parsed = new URL(url);
  return {
    res,
    url: parsed,
    state: parsed.searchParams.get('state'),
    nonce: res.cookie.mock.calls[0][1],
  };
}

const callbackReq = ({ state, nonce, code = 'auth-code', error } = {}) => ({
  query: { state, code, ...(error ? { error } : {}) },
  headers: { cookie: nonce ? `tumblr_oauth_nonce=${nonce}` : '' },
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  process.env.TUMBLR_CLIENT_ID = 'client-id';
  process.env.TUMBLR_CLIENT_SECRET = 'client-secret';
  process.env.TUMBLR_REDIRECT_URI = 'http://localhost:4500/api/auth/tumblr/callback';
  process.env.OAUTH_STATE_SECRET = 'test-state-secret';
  process.env.FRONTEND_URL = 'https://app.test';
  delete process.env.TUMBLR_RETURN_PATH;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe('getUserId', () => {
  it('prefers requestorId, then id, then _id', () => {
    expect(getUserId({ user: { requestorId: 'a', id: 'b', _id: 'c' } })).toBe('a');
    expect(getUserId({ user: { id: 'b', _id: 'c' } })).toBe('b');
    expect(getUserId({ user: { _id: 'c' } })).toBe('c');
  });

  it('throws a 401 TumblrError when there is no user', () => {
    expect.assertions(3);
    try {
      getUserId({});
    } catch (err) {
      expect(err).toBeInstanceOf(TumblrError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('unauthenticated');
    }
  });
});

describe('sendError', () => {
  it('serialises TumblrError with its status and code', () => {
    const res = makeRes();
    sendError(res, new TumblrError('nope', 418, 'teapot'));
    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith({ error: 'nope', code: 'teapot' });
  });

  it('hides unknown errors behind a generic 500', () => {
    const res = makeRes();
    sendError(res, new Error('db password is hunter2'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong. Try again.' });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('start', () => {
  it('returns an authorize URL with the expected params', async () => {
    const { url } = await runStart();
    expect(url.origin + url.pathname).toBe('https://www.tumblr.com/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('basic write offline_access');
    expect(url.searchParams.get('redirect_uri')).toBe(process.env.TUMBLR_REDIRECT_URI);
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('sets an httpOnly, lax, 10-minute nonce cookie', async () => {
    const { res } = await runStart();
    const [name, nonce, opts] = res.cookie.mock.calls[0];
    expect(name).toBe('tumblr_oauth_nonce');
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(opts).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
  });

  it('generates a different state each time', async () => {
    const a = await runStart();
    const b = await runStart();
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = makeRes();
    await ctrl.start({}, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.cookie).not.toHaveBeenCalled();
  });
});

describe('callback', () => {
  const tokenBody = {
    access_token: 'new-access',
    refresh_token: 'new-refresh',
    expires_in: 7200,
    scope: 'basic write offline_access',
  };

  it('stores tokens + blogs for a new connection and redirects "connected"', async () => {
    const { state, nonce } = await runStart('u1');
    TumblrConnection.findOne.mockResolvedValue(null);
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, tokenBody))
      .mockResolvedValueOnce(jsonResponse(200, userInfoBody));

    const res = makeRes();
    await ctrl.callback(callbackReq({ state, nonce }), res);

    // token exchange
    const [tokenUrl, tokenInit] = global.fetch.mock.calls[0];
    expect(tokenUrl).toBe('https://api.tumblr.com/v2/oauth2/token');
    expect(tokenInit.body.get('grant_type')).toBe('authorization_code');
    expect(tokenInit.body.get('code')).toBe('auth-code');
    expect(tokenInit.body.get('client_secret')).toBe('client-secret');

    // user info uses the new access token
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer new-access');

    // persisted connection
    expect(TumblrConnection).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
    const saved = TumblrConnection.mock.instances[0];
    expect(saved.accessTokenEnc).toBe('enc(new-access)');
    expect(saved.refreshTokenEnc).toBe('enc(new-refresh)');
    expect(saved.tumblrUsername).toBe('alice');
    expect(saved.blogs).toEqual([{ name: 'new', title: 'New', uuid: 'x1' }]);
    expect(saved.needsReauth).toBe(false);
    expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now() + 7000 * 1000);
    expect(saved.save).toHaveBeenCalled();

    expect(res.redirect).toHaveBeenCalledWith(
      'https://app.test/announcements/tumblr?tumblr=connected',
    );
  });

  it('updates an existing connection instead of creating a new one', async () => {
    const { state, nonce } = await runStart('u1');
    const existing = makeConnection({ needsReauth: true });
    TumblrConnection.findOne.mockResolvedValue(existing);
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, tokenBody))
      .mockResolvedValueOnce(jsonResponse(200, userInfoBody));

    await ctrl.callback(callbackReq({ state, nonce }), makeRes());

    expect(TumblrConnection).not.toHaveBeenCalled();
    expect(existing.accessTokenEnc).toBe('enc(new-access)');
    expect(existing.needsReauth).toBe(false);
    expect(existing.save).toHaveBeenCalled();
  });

  it('honours TUMBLR_RETURN_PATH and appends with & when it has a query', async () => {
    process.env.TUMBLR_RETURN_PATH = '/settings?tab=social';
    const { state, nonce } = await runStart();
    TumblrConnection.findOne.mockResolvedValue(null);
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, tokenBody))
      .mockResolvedValueOnce(jsonResponse(200, userInfoBody));

    const res = makeRes();
    await ctrl.callback(callbackReq({ state, nonce }), res);
    expect(res.redirect).toHaveBeenCalledWith(
      'https://app.test/settings?tab=social&tumblr=connected',
    );
  });

  it('clears the nonce cookie on every attempt (single use)', async () => {
    const res = makeRes();
    await ctrl.callback(callbackReq({ state: 'garbage' }), res);
    expect(res.clearCookie).toHaveBeenCalledWith('tumblr_oauth_nonce', expect.any(Object));
  });

  it('rejects a tampered state', async () => {
    const { state, nonce } = await runStart();
    const tampered = state.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
    const res = makeRes();
    await ctrl.callback(callbackReq({ state: tampered, nonce }), res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=error'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a state signed with a different secret', async () => {
    const { state, nonce } = await runStart();
    process.env.OAUTH_STATE_SECRET = 'another-secret';
    const res = makeRes();
    await ctrl.callback(callbackReq({ state, nonce }), res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=error'));
  });

  it('rejects an expired state', async () => {
    const { state, nonce } = await runStart();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);
    try {
      const res = makeRes();
      await ctrl.callback(callbackReq({ state, nonce }), res);
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=error'));
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects when the nonce cookie is missing', async () => {
    const { state } = await runStart();
    const res = makeRes();
    await ctrl.callback(callbackReq({ state }), res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=error'));
  });

  it('rejects when the nonce cookie does not match the state', async () => {
    const { state } = await runStart();
    const res = makeRes();
    await ctrl.callback(callbackReq({ state, nonce: 'f'.repeat(32) }), res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=error'));
  });

  it('rejects a missing state', async () => {
    const res = makeRes();
    await ctrl.callback({ query: { code: 'x' }, headers: {} }, res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=error'));
  });

  it('redirects "denied" when the user declines on Tumblr', async () => {
    const { state, nonce } = await runStart();
    const res = makeRes();
    await ctrl.callback(
      callbackReq({ state, nonce, error: 'access_denied', code: undefined }),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=denied'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('redirects error when code is missing or not a string', async () => {
    const { state, nonce } = await runStart();
    const res = makeRes();
    await ctrl.callback(
      { query: { state }, headers: { cookie: `tumblr_oauth_nonce=${nonce}` } },
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=error'));
  });

  it('redirects error when Tumblr omits the refresh token', async () => {
    const { state, nonce } = await runStart();
    global.fetch.mockResolvedValueOnce(jsonResponse(200, { access_token: 'a' }));
    const res = makeRes();
    await ctrl.callback(callbackReq({ state, nonce }), res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=error'));
    expect(TumblrConnection.findOne).not.toHaveBeenCalled();
  });

  it('redirects error when the token exchange fails', async () => {
    const { state, nonce } = await runStart();
    global.fetch.mockResolvedValueOnce(jsonResponse(400, { error: 'invalid_grant' }));
    const res = makeRes();
    await ctrl.callback(callbackReq({ state, nonce }), res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=error'));
  });

  it('redirects error when the user-info call fails, and saves nothing', async () => {
    const { state, nonce } = await runStart();
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, tokenBody))
      .mockResolvedValueOnce(jsonResponse(500, { meta: { msg: 'boom' } }));
    const res = makeRes();
    await ctrl.callback(callbackReq({ state, nonce }), res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('tumblr=error'));
    expect(TumblrConnection.findOne).not.toHaveBeenCalled();
  });

  it('returns 500 when FRONTEND_URL is not configured', async () => {
    delete process.env.FRONTEND_URL;
    const res = makeRes();
    await ctrl.callback(callbackReq({ state: 'garbage' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('FRONTEND_URL'));
  });
});

describe('getValidToken', () => {
  const refreshBody = {
    access_token: 'new-access',
    refresh_token: 'new-refresh',
    expires_in: 7200,
  };

  it('throws reauth_required when there is no connection', async () => {
    TumblrConnection.findOne.mockResolvedValue(null);
    await expect(getValidToken('u1')).rejects.toMatchObject({
      status: 401,
      code: 'reauth_required',
    });
  });

  it('throws reauth_required when the connection is flagged needsReauth', async () => {
    TumblrConnection.findOne.mockResolvedValue(makeConnection({ needsReauth: true }));
    await expect(getValidToken('u1')).rejects.toMatchObject({ code: 'reauth_required' });
  });

  it('returns the decrypted token without refreshing when still valid', async () => {
    TumblrConnection.findOne.mockResolvedValue(makeConnection());
    await expect(getValidToken('u1')).resolves.toBe('old-access');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refreshes when expired and persists the new tokens', async () => {
    const conn = makeConnection({ expiresAt: new Date(Date.now() - 1000) });
    TumblrConnection.findOne.mockResolvedValue(conn);
    global.fetch.mockResolvedValueOnce(jsonResponse(200, refreshBody));

    await expect(getValidToken('u1')).resolves.toBe('new-access');

    const { body } = global.fetch.mock.calls[0][1];
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('old-refresh');
    expect(conn.refreshTokenEnc).toBe('enc(new-refresh)');
    expect(conn.save).toHaveBeenCalled();
  });

  it('refreshes inside the 60s expiry skew window', async () => {
    const conn = makeConnection({ expiresAt: new Date(Date.now() + 30 * 1000) });
    TumblrConnection.findOne.mockResolvedValue(conn);
    global.fetch.mockResolvedValueOnce(jsonResponse(200, refreshBody));
    await getValidToken('u1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes when forceRefresh is set even if the token is valid', async () => {
    TumblrConnection.findOne.mockResolvedValue(makeConnection());
    global.fetch.mockResolvedValueOnce(jsonResponse(200, refreshBody));
    await expect(getValidToken('u1', { forceRefresh: true })).resolves.toBe('new-access');
  });

  it('keeps the old refresh token when Tumblr does not rotate it', async () => {
    const conn = makeConnection({ expiresAt: new Date(Date.now() - 1000) });
    TumblrConnection.findOne.mockResolvedValue(conn);
    global.fetch.mockResolvedValueOnce(
      jsonResponse(200, { access_token: 'new-access', expires_in: 3600 }),
    );
    await getValidToken('u1');
    expect(conn.refreshTokenEnc).toBe('enc(old-refresh)');
  });

  it.each([400, 401])(
    'flags needsReauth and throws reauth_required on a %i refresh',
    async (status) => {
      const conn = makeConnection({ expiresAt: new Date(Date.now() - 1000) });
      TumblrConnection.findOne.mockResolvedValue(conn);
      global.fetch.mockResolvedValueOnce(jsonResponse(status, { error: 'invalid_grant' }));

      await expect(getValidToken('u1')).rejects.toMatchObject({
        status: 401,
        code: 'reauth_required',
      });
      expect(conn.needsReauth).toBe(true);
      expect(conn.save).toHaveBeenCalled();
    },
  );

  it('does not flag needsReauth on transient (5xx) refresh failures', async () => {
    const conn = makeConnection({ expiresAt: new Date(Date.now() - 1000) });
    TumblrConnection.findOne.mockResolvedValue(conn);
    global.fetch.mockResolvedValueOnce(jsonResponse(503, {}));

    await expect(getValidToken('u1')).rejects.toMatchObject({ status: 503 });
    expect(conn.needsReauth).toBe(false);
    expect(conn.save).not.toHaveBeenCalled();
  });

  it('shares one in-flight refresh between concurrent callers', async () => {
    const conn = makeConnection({ expiresAt: new Date(Date.now() - 1000) });
    TumblrConnection.findOne.mockResolvedValue(conn);
    global.fetch.mockResolvedValue(jsonResponse(200, refreshBody));

    const [a, b] = await Promise.all([getValidToken('u1'), getValidToken('u1')]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(a).toBe('new-access');
    expect(b).toBe('new-access');
  });

  it('releases the lock after a failure so a later call can retry', async () => {
    const conn = makeConnection({ expiresAt: new Date(Date.now() - 1000) });
    TumblrConnection.findOne.mockResolvedValue(conn);
    global.fetch
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, refreshBody));

    await expect(getValidToken('u1')).rejects.toMatchObject({ status: 503 });
    await expect(getValidToken('u1')).resolves.toBe('new-access');
  });
});

describe('markNeedsReauth', () => {
  it('sets the flag for the user', async () => {
    await markNeedsReauth('u1');
    expect(TumblrConnection.updateOne).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: { needsReauth: true } },
    );
  });
});

describe('status', () => {
  const req = { user: { id: 'u1' } };

  it('returns 401 when unauthenticated', async () => {
    const res = makeRes();
    await ctrl.status({}, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('reports not connected when there is no connection', async () => {
    TumblrConnection.findOne.mockResolvedValue(null);
    const res = makeRes();
    await ctrl.status(req, res);
    expect(res.json).toHaveBeenCalledWith({ connected: false, needsReauth: false, blogs: [] });
  });

  it('reports needsReauth when flagged', async () => {
    TumblrConnection.findOne.mockResolvedValue(makeConnection({ needsReauth: true }));
    const res = makeRes();
    await ctrl.status(req, res);
    expect(res.json).toHaveBeenCalledWith({ connected: false, needsReauth: true, blogs: [] });
  });

  it('returns stored blogs (without uuid) when the list is fresh', async () => {
    TumblrConnection.findOne.mockResolvedValue(makeConnection());
    const res = makeRes();
    await ctrl.status(req, res);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      connected: true,
      username: 'alice',
      blogs: [{ name: 'blog1', title: 'Blog One' }],
    });
  });

  it('re-fetches and saves blogs when the list is stale', async () => {
    const conn = makeConnection({ blogsUpdatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });
    TumblrConnection.findOne.mockResolvedValue(conn);
    global.fetch.mockResolvedValueOnce(jsonResponse(200, userInfoBody));

    const res = makeRes();
    await ctrl.status(req, res);

    expect(conn.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      connected: true,
      username: 'alice',
      blogs: [{ name: 'new', title: 'New' }],
    });
  });

  it('re-fetches when blogsUpdatedAt was never set', async () => {
    const conn = makeConnection({ blogsUpdatedAt: undefined });
    TumblrConnection.findOne.mockResolvedValue(conn);
    global.fetch.mockResolvedValueOnce(jsonResponse(200, userInfoBody));
    await ctrl.status(req, makeRes());
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to stored blogs when the refresh call fails', async () => {
    const conn = makeConnection({ blogsUpdatedAt: new Date(0) });
    TumblrConnection.findOne.mockResolvedValue(conn);
    global.fetch.mockResolvedValueOnce(jsonResponse(500, {}));

    const res = makeRes();
    await ctrl.status(req, res);

    expect(conn.save).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      connected: true,
      username: 'alice',
      blogs: [{ name: 'blog1', title: 'Blog One' }],
    });
  });

  it('reports needsReauth when a stale refresh discovers the token is dead', async () => {
    const conn = makeConnection({
      blogsUpdatedAt: new Date(0),
      expiresAt: new Date(Date.now() - 1000),
    });
    TumblrConnection.findOne.mockResolvedValue(conn);
    global.fetch.mockResolvedValueOnce(jsonResponse(400, { error: 'invalid_grant' }));

    const res = makeRes();
    await ctrl.status(req, res);
    expect(res.json).toHaveBeenCalledWith({ connected: false, needsReauth: true, blogs: [] });
  });
});

describe('disconnect', () => {
  it('deletes the connection', async () => {
    const res = makeRes();
    await ctrl.disconnect({ user: { id: 'u1' } }, res);
    expect(TumblrConnection.deleteOne).toHaveBeenCalledWith({ userId: 'u1' });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 401 when unauthenticated', async () => {
    const res = makeRes();
    await ctrl.disconnect({}, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(TumblrConnection.deleteOne).not.toHaveBeenCalled();
  });

  it('returns 500 if the delete fails', async () => {
    TumblrConnection.deleteOne.mockRejectedValueOnce(new Error('db down'));
    const res = makeRes();
    await ctrl.disconnect({ user: { id: 'u1' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
