jest.mock('../../models/tumblrConnection', () => ({
  TumblrConnection: { findOne: jest.fn() },
  encrypt: (v) => v,
  decrypt: (v) => v,
}));

jest.mock('../tumblrAuthController', () => {
  const actual = jest.requireActual('../tumblrAuthController');
  return { ...actual, getValidToken: jest.fn(), markNeedsReauth: jest.fn() };
});

const { TumblrConnection } = require('../../models/tumblrConnection');
const auth = require('../tumblrAuthController');
const ctrl = require('../tumblrPostController');

const { sanitizePost, postNow, schedulePost, listScheduled, cancelScheduled } = ctrl;

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const jsonResponse = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const textPost = (text = 'hello') => ({ content: [{ type: 'text', text }] });
const DAY = 24 * 60 * 60 * 1000;

const lastFetch = () => {
  const [url, init] = global.fetch.mock.calls.at(-1);
  return { url, init, body: init.body };
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  auth.getValidToken.mockResolvedValue('tok');
  auth.markNeedsReauth.mockResolvedValue(undefined);
  TumblrConnection.findOne.mockResolvedValue({
    needsReauth: false,
    blogs: [{ name: 'myblog' }, { name: 'other-blog' }],
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe('sanitizePost', () => {
  const invalid = (raw) =>
    expect(() => sanitizePost(raw)).toThrow(
      expect.objectContaining({ status: 400, code: 'invalid_post' }),
    );

  describe('content shape', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['missing content', {}],
      ['non-array content', { content: 'hi' }],
      ['empty content', { content: [] }],
    ])('rejects %s', (_label, raw) => invalid(raw));

    it('accepts exactly 50 blocks and rejects 51', () => {
      const blocks = (n) => Array.from({ length: n }, () => ({ type: 'text', text: 'x' }));
      expect(sanitizePost({ content: blocks(50) }).content).toHaveLength(50);
      invalid({ content: blocks(51) });
    });

    it('rejects unsupported and null blocks', () => {
      invalid({ content: [{ type: 'poll' }] });
      invalid({ content: [null] });
    });
  });

  describe('text blocks', () => {
    it('keeps plain text', () => {
      expect(sanitizePost(textPost('hi')).content).toEqual([{ type: 'text', text: 'hi' }]);
    });

    it('rejects empty, whitespace-only, and non-string text', () => {
      invalid(textPost(''));
      invalid(textPost('   '));
      invalid({ content: [{ type: 'text', text: 42 }] });
    });

    it('enforces the 4096-char limit', () => {
      expect(sanitizePost(textPost('a'.repeat(4096))).content[0].text).toHaveLength(4096);
      invalid(textPost('a'.repeat(4097)));
    });

    it('keeps the heading1 subtype and drops any other subtype', () => {
      const out = sanitizePost({
        content: [
          { type: 'text', text: 'H', subtype: 'heading1' },
          { type: 'text', text: 'Q', subtype: 'quote' },
        ],
      }).content;
      expect(out[0]).toEqual({ type: 'text', text: 'H', subtype: 'heading1' });
      expect(out[1]).toEqual({ type: 'text', text: 'Q' });
    });

    it('strips unknown fields (allow-list)', () => {
      const out = sanitizePost({
        content: [{ type: 'text', text: 'hi', formatting: [{ evil: true }], extra: 1 }],
      }).content[0];
      expect(out).toEqual({ type: 'text', text: 'hi' });
    });
  });

  describe('image blocks', () => {
    it('keeps a valid image URL', () => {
      const out = sanitizePost({
        content: [{ type: 'image', media: [{ url: 'https://img.test/a.png', width: 5 }] }],
      }).content[0];
      expect(out).toEqual({ type: 'image', media: [{ url: 'https://img.test/a.png' }] });
    });

    it('preserves image/gif and drops other media types', () => {
      const gif = sanitizePost({
        content: [{ type: 'image', media: [{ url: 'https://img.test/a.gif', type: 'image/gif' }] }],
      }).content[0];
      expect(gif.media[0].type).toBe('image/gif');

      const png = sanitizePost({
        content: [{ type: 'image', media: [{ url: 'https://img.test/a.png', type: 'image/png' }] }],
      }).content[0];
      expect(png.media[0]).not.toHaveProperty('type');
    });

    it.each([
      ['missing media', { type: 'image' }],
      ['empty media', { type: 'image', media: [] }],
      ['javascript: URL', { type: 'image', media: [{ url: 'javascript:alert(1)' }] }],
      ['data: URL', { type: 'image', media: [{ url: 'data:image/png;base64,AAAA' }] }],
      ['not a URL', { type: 'image', media: [{ url: 'nope' }] }],
    ])('rejects %s', (_l, block) => invalid({ content: [block] }));
  });

  describe('link / video / audio blocks', () => {
    it('keeps valid links', () => {
      expect(
        sanitizePost({ content: [{ type: 'link', url: 'http://a.test', junk: 1 }] }).content[0],
      ).toEqual({ type: 'link', url: 'http://a.test' });
    });

    it('rejects links with non-http(s) schemes', () => {
      invalid({ content: [{ type: 'link', url: 'ftp://a.test' }] });
      invalid({ content: [{ type: 'link' }] });
    });

    it.each(['video', 'audio'])('keeps %s provider, defaulting to "unknown"', (type) => {
      const withProvider = sanitizePost({
        content: [{ type, url: 'https://a.test', provider: 'youtube' }],
      });
      expect(withProvider.content[0]).toEqual({ type, url: 'https://a.test', provider: 'youtube' });

      const without = sanitizePost({ content: [{ type, url: 'https://a.test', provider: 5 }] });
      expect(without.content[0].provider).toBe('unknown');
    });

    it.each(['video', 'audio'])('rejects %s with a bad URL', (type) => {
      invalid({ content: [{ type, url: 'file:///etc/passwd' }] });
    });
  });

  describe('tags', () => {
    const tagsFor = (tags) => sanitizePost({ ...textPost(), tags }).tags;

    it('trims, strips leading #, and drops empties', () => {
      expect(tagsFor([' news ', '#launch', '##double', '#', '   ', ''])).toEqual([
        'news',
        'launch',
        'double',
      ]);
    });

    it('dedupes case-insensitively, keeping the first spelling', () => {
      expect(tagsFor(['Launch', 'launch', 'LAUNCH', 'other'])).toEqual(['Launch', 'other']);
    });

    it('ignores non-string entries', () => {
      expect(tagsFor(['ok', 1, null, {}, ['x']])).toEqual(['ok']);
    });

    it('caps at 30 tags', () => {
      const many = Array.from({ length: 40 }, (_, i) => `t${i}`);
      expect(tagsFor(many)).toHaveLength(30);
    });

    it('returns [] for non-array / missing tags', () => {
      expect(tagsFor('a,b')).toEqual([]);
      expect(sanitizePost(textPost()).tags).toEqual([]);
    });
  });

  describe('state', () => {
    it('is "private" only when explicitly private, otherwise "published"', () => {
      expect(sanitizePost({ ...textPost(), state: 'private' }).state).toBe('private');
      expect(sanitizePost({ ...textPost(), state: 'published' }).state).toBe('published');
      expect(sanitizePost({ ...textPost(), state: 'draft' }).state).toBe('published');
      expect(sanitizePost(textPost()).state).toBe('published');
    });
  });
});

describe('postNow', () => {
  const req = (body, user = { id: 'u1' }) => ({ user, body });

  it('posts sanitized content to the blog and returns the id', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(201, { response: { id_string: '12345' } }));
    const res = makeRes();

    await postNow(
      req({
        blog: 'myblog',
        post: {
          content: [{ type: 'text', text: 'hi', evil: 1 }],
          tags: ['#a', 'b'],
          state: 'private',
        },
      }),
      res,
    );

    const { url, init, body } = lastFetch();
    expect(url).toBe('https://api.tumblr.com/v2/blog/myblog/posts');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(body)).toEqual({
      content: [{ type: 'text', text: 'hi' }],
      tags: 'a,b',
      state: 'private',
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, id: '12345' });
  });

  it('falls back to numeric id and tolerates a missing id', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(201, { response: { id: 99 } }));
    const res1 = makeRes();
    await postNow(req({ blog: 'myblog', post: textPost() }), res1);
    expect(res1.json).toHaveBeenCalledWith({ ok: true, id: '99' });

    global.fetch.mockResolvedValueOnce(jsonResponse(201, {}));
    const res2 = makeRes();
    await postNow(req({ blog: 'myblog', post: textPost() }), res2);
    expect(res2.json).toHaveBeenCalledWith({ ok: true, id: undefined });
  });

  it('URL-encodes the blog name', async () => {
    TumblrConnection.findOne.mockResolvedValue({
      needsReauth: false,
      blogs: [{ name: 'my blog/x' }],
    });
    global.fetch.mockResolvedValueOnce(jsonResponse(201, { response: { id: 1 } }));
    await postNow(req({ blog: 'my blog/x', post: textPost() }), makeRes());
    expect(lastFetch().url).toBe('https://api.tumblr.com/v2/blog/my%20blog%2Fx/posts');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = makeRes();
    await postNow({ user: undefined, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it.each([
    ['missing blog', undefined],
    ['non-string blog', { name: 'myblog' }],
    ['empty blog', ''],
  ])('rejects %s with 400', async (_l, blog) => {
    const res = makeRes();
    await postNow(req({ blog, post: textPost() }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a blog that isn't on the connected account", async () => {
    const res = makeRes();
    await postNow(req({ blog: 'someone-elses-blog', post: textPost() }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_post' }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 401 reauth_required when not connected or flagged', async () => {
    TumblrConnection.findOne.mockResolvedValueOnce(null);
    const res1 = makeRes();
    await postNow(req({ blog: 'myblog', post: textPost() }), res1);
    expect(res1.status).toHaveBeenCalledWith(401);
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'reauth_required' }));

    TumblrConnection.findOne.mockResolvedValueOnce({
      needsReauth: true,
      blogs: [{ name: 'myblog' }],
    });
    const res2 = makeRes();
    await postNow(req({ blog: 'myblog', post: textPost() }), res2);
    expect(res2.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 for an invalid post and never calls Tumblr', async () => {
    const res = makeRes();
    await postNow(req({ blog: 'myblog', post: { content: [] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('surfaces Tumblr error details', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(400, { errors: [{ detail: 'Bad block' }] }));
    const res = makeRes();
    await postNow(req({ blog: 'myblog', post: textPost() }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Bad block' }));
  });

  it('returns a friendly message on a 429', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(429, {}));
    const res = makeRes();
    await postNow(req({ blog: 'myblog', post: textPost() }), res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Tumblr rate limit reached. Try again in a few minutes.',
    });
  });

  describe('401 retry', () => {
    it('force-refreshes the token and retries once', async () => {
      auth.getValidToken.mockResolvedValueOnce('stale').mockResolvedValueOnce('fresh');
      global.fetch
        .mockResolvedValueOnce(jsonResponse(401, {}))
        .mockResolvedValueOnce(jsonResponse(201, { response: { id_string: '7' } }));

      const res = makeRes();
      await postNow(req({ blog: 'myblog', post: textPost() }), res);

      expect(auth.getValidToken).toHaveBeenNthCalledWith(2, 'u1', { forceRefresh: true });
      expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer stale');
      expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
      expect(res.json).toHaveBeenCalledWith({ ok: true, id: '7' });
      expect(auth.markNeedsReauth).not.toHaveBeenCalled();
    });

    it('flags needsReauth and returns reauth_required if the retry is also 401', async () => {
      global.fetch.mockResolvedValue(jsonResponse(401, {}));
      const res = makeRes();
      await postNow(req({ blog: 'myblog', post: textPost() }), res);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(auth.markNeedsReauth).toHaveBeenCalledWith('u1');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'reauth_required' }));
    });

    it('does not retry non-401 errors', async () => {
      global.fetch.mockResolvedValueOnce(jsonResponse(500, {}));
      const res = makeRes();
      await postNow(req({ blog: 'myblog', post: textPost() }), res);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('propagates a non-401 error from the retry', async () => {
      global.fetch
        .mockResolvedValueOnce(jsonResponse(401, {}))
        .mockResolvedValueOnce(jsonResponse(502, {}));
      const res = makeRes();
      await postNow(req({ blog: 'myblog', post: textPost() }), res);
      expect(res.status).toHaveBeenCalledWith(502);
      expect(auth.markNeedsReauth).not.toHaveBeenCalled();
    });
  });
});

describe('schedulePost', () => {
  const req = (body) => ({ user: { id: 'u1' }, body });
  const inDays = (n) => new Date(Date.now() + n * DAY).toISOString();

  it('queues the post with publish_on and responds 201', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(201, { response: { id_string: '55' } }));
    const when = inDays(2);
    const res = makeRes();

    await schedulePost(req({ blog: 'myblog', post: textPost(), scheduledAt: when }), res);

    const sent = JSON.parse(lastFetch().body);
    expect(sent.state).toBe('queue');
    expect(sent.publish_on).toBe(new Date(when).toISOString());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true, id: '55' });
  });

  it('refuses private posts', async () => {
    const res = makeRes();
    await schedulePost(
      req({ blog: 'myblog', post: { ...textPost(), state: 'private' }, scheduledAt: inDays(1) }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['garbage', 'not-a-date'],
    ['undefined', undefined],
  ])('rejects an invalid date (%s)', async (_l, scheduledAt) => {
    const res = makeRes();
    await schedulePost(req({ blog: 'myblog', post: textPost(), scheduledAt }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Pick a valid date and time.' }),
    );
  });

  it('rejects dates in the past', async () => {
    const res = makeRes();
    await schedulePost(
      req({
        blog: 'myblog',
        post: textPost(),
        scheduledAt: new Date(Date.now() - 1000).toISOString(),
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Pick a date and time in the future.' }),
    );
  });

  it('rejects dates more than a year out', async () => {
    const res = makeRes();
    await schedulePost(req({ blog: 'myblog', post: textPost(), scheduledAt: inDays(366) }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts a date just inside the one-year window', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(201, { response: { id: 1 } }));
    const res = makeRes();
    await schedulePost(req({ blog: 'myblog', post: textPost(), scheduledAt: inDays(364) }), res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects a blog that isn't owned", async () => {
    const res = makeRes();
    await schedulePost(req({ blog: 'nope', post: textPost(), scheduledAt: inDays(1) }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns a friendly message on a 429', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(429, {}));
    const res = makeRes();
    await schedulePost(req({ blog: 'myblog', post: textPost(), scheduledAt: inDays(1) }), res);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

describe('listScheduled', () => {
  const req = (blog = 'myblog') => ({ user: { id: 'u1' }, query: { blog } });

  it('requests the queue in NPF format and maps the results', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse(200, {
        response: {
          posts: [
            {
              id_string: '111',
              scheduled_publish_time: 1_800_000_000,
              content: [{ type: 'text', text: 'First post' }],
            },
            { id: 222, content: [{ type: 'image' }] },
          ],
        },
      }),
    );
    const res = makeRes();
    await listScheduled(req(), res);

    expect(lastFetch().url).toBe(
      'https://api.tumblr.com/v2/blog/myblog/posts/queue?limit=20&npf=true',
    );
    expect(res.json).toHaveBeenCalledWith({
      items: [
        {
          id: '111',
          blog: 'myblog',
          scheduledAt: new Date(1_800_000_000 * 1000),
          status: 'pending',
          preview: 'First post',
        },
        { id: '222', blog: 'myblog', scheduledAt: null, status: 'pending', preview: '[image]' },
      ],
    });
  });

  it('returns an empty list when Tumblr has no posts', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(200, { response: {} }));
    const res = makeRes();
    await listScheduled(req(), res);
    expect(res.json).toHaveBeenCalledWith({ items: [] });
  });

  describe('preview text', () => {
    const previewOf = async (post) => {
      global.fetch.mockResolvedValueOnce(
        jsonResponse(200, { response: { posts: [{ id: 1, ...post }] } }),
      );
      const res = makeRes();
      await listScheduled(req(), res);
      return res.json.mock.calls[0][0].items[0].preview;
    };

    it('prefers body text over a heading', async () => {
      expect(
        await previewOf({
          content: [
            { type: 'text', subtype: 'heading1', text: 'Title' },
            { type: 'text', text: 'Body' },
          ],
        }),
      ).toBe('Body');
    });

    it('uses a heading when it is the only text', async () => {
      expect(
        await previewOf({ content: [{ type: 'text', subtype: 'heading1', text: 'Title' }] }),
      ).toBe('Title');
    });

    it('truncates to 80 chars with an ellipsis', async () => {
      const preview = await previewOf({ content: [{ type: 'text', text: 'a'.repeat(100) }] });
      expect(preview).toBe(`${'a'.repeat(80)}…`);
    });

    it('does not truncate exactly-80-char text', async () => {
      const text = 'a'.repeat(80);
      expect(await previewOf({ content: [{ type: 'text', text }] })).toBe(text);
    });

    it('falls back to the summary, then empty string', async () => {
      expect(await previewOf({ content: [], summary: 'sum' })).toBe('sum');
      expect(await previewOf({})).toBe('');
    });
  });

  it('rejects an unowned blog', async () => {
    const res = makeRes();
    await listScheduled(req('nope'), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('surfaces Tumblr failures', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(500, { meta: { msg: 'Server error' } }));
    const res = makeRes();
    await listScheduled(req(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Server error' }));
  });
});

describe('cancelScheduled', () => {
  const req = ({ id = '123', blog = 'myblog' } = {}) => ({
    user: { id: 'u1' },
    query: { blog },
    params: { id },
  });

  it('deletes the post using a form-encoded body', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(200, {}));
    const res = makeRes();
    await cancelScheduled(req(), res);

    const { url, init, body } = lastFetch();
    expect(url).toBe('https://api.tumblr.com/v2/blog/myblog/post/delete');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(body.toString()).toBe('id=123');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it.each(['abc', '12abc', '1 2', '../1', '-5', ''])(
    'returns 404 for non-numeric id %j',
    async (id) => {
      const res = makeRes();
      await cancelScheduled(req({ id }), res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it('rejects an unowned blog before calling Tumblr', async () => {
    const res = makeRes();
    await cancelScheduled(req({ blog: 'nope' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('retries once with a refreshed token on 401', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    const res = makeRes();
    await cancelScheduled(req(), res);
    expect(auth.getValidToken).toHaveBeenLastCalledWith('u1', { forceRefresh: true });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('surfaces Tumblr errors', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(404, { meta: { msg: 'Not Found' } }));
    const res = makeRes();
    await cancelScheduled(req(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Not Found' }));
  });
});

describe('publishToTumblr', () => {
  it('publishes with a post state when there is no publishOn', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(201, { response: { id_string: '9' } }));
    const post = sanitizePost({ ...textPost(), tags: ['x'] });
    await expect(ctrl.publishToTumblr({ userId: 'u1', blog: 'myblog', post })).resolves.toEqual({
      id: '9',
    });

    const sent = JSON.parse(lastFetch().body);
    expect(sent.state).toBe('published');
    expect(sent).not.toHaveProperty('publish_on');
  });

  it('forces state "queue" when publishOn is given', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(201, { response: { id: 1 } }));
    const post = sanitizePost(textPost());
    const publishOn = new Date(Date.now() + DAY);
    await ctrl.publishToTumblr({ userId: 'u1', blog: 'myblog', post, publishOn });

    const sent = JSON.parse(lastFetch().body);
    expect(sent.state).toBe('queue');
    expect(sent.publish_on).toBe(publishOn.toISOString());
  });
});
