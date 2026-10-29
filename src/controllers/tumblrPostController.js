const { TumblrConnection } = require('../models/tumblrConnection');
const {
  TumblrError,
  getValidToken,
  markNeedsReauth,
  getUserId,
  sendError,
} = require('./tumblrAuthController');

const API_BASE = process.env.TUMBLR_API_BASE || 'https://api.tumblr.com/v2';

// Adjust to Tumblr's current NPF limits
const MAX_BLOCKS = 50;
const MAX_TAGS = 30;
const MAX_TEXT_LENGTH = 4096;
const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const badRequest = (message) => new TumblrError(message, 400, 'invalid_post');

/* ───────────── validation ───────────── */

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function requireUrl(value, label) {
  if (!isHttpUrl(value)) throw badRequest(`${label} needs a valid http(s) URL.`);
  return value;
}

/**
 * Rebuilds the post from an allow-list instead of forwarding the client's object,
 * so unknown fields and block types never reach Tumblr or the database.
 * Returns { content, tags: string[], state }.
 */
function sanitizePost(raw) {
  if (!raw || !Array.isArray(raw.content) || raw.content.length === 0) {
    throw badRequest('Add some content before posting.');
  }
  if (raw.content.length > MAX_BLOCKS) {
    throw badRequest(`Posts can have at most ${MAX_BLOCKS} content blocks.`);
  }

  const content = raw.content.map((block) => {
    switch (block?.type) {
      case 'text': {
        if (typeof block.text !== 'string' || !block.text.trim())
          throw badRequest('Text blocks can’t be empty.');
        if (block.text.length > MAX_TEXT_LENGTH)
          throw badRequest(`Text blocks are limited to ${MAX_TEXT_LENGTH} characters.`);
        const out = { type: 'text', text: block.text };
        if (block.subtype === 'heading1') out.subtype = 'heading1';
        return out;
      }
      case 'image': {
        const media = block.media?.[0];
        const out = { url: requireUrl(media?.url, 'Image') };
        if (media?.type === 'image/gif') out.type = 'image/gif';
        return { type: 'image', media: [out] };
      }
      case 'link':
        return { type: 'link', url: requireUrl(block.url, 'Link') };
      case 'video':
      case 'audio':
        return {
          type: block.type,
          url: requireUrl(block.url, block.type === 'video' ? 'Video' : 'Audio'),
          provider: typeof block.provider === 'string' ? block.provider : 'unknown',
        };
      default:
        throw badRequest('Unsupported content block.');
    }
  });

  const seen = new Set();
  const tags = (Array.isArray(raw.tags) ? raw.tags : [])
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim().replace(/^#+/, '').trim())
    .filter((t) => {
      const k = t.toLowerCase();
      if (!t || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_TAGS);

  return { content, tags, state: raw.state === 'private' ? 'private' : 'published' };
}

async function assertBlogOwned(userId, blog) {
  if (typeof blog !== 'string' || !blog) throw badRequest('Choose a blog to post to.');
  const connection = await TumblrConnection.findOne({ userId });
  if (!connection || connection.needsReauth) {
    throw new TumblrError(
      'Tumblr is not connected. Connect your account to continue.',
      401,
      'reauth_required',
    );
  }
  if (!connection.blogs.some((b) => b.name === blog)) {
    throw badRequest('That blog isn’t on your connected Tumblr account.');
  }
}

/* ───────────── Tumblr calls ───────────── */

async function tumblrFetch(accessToken, path, { headers, ...options } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.errors?.[0]?.detail || data.errors?.[0]?.title || data.meta?.msg;
    throw new TumblrError(detail || `Tumblr request failed (${res.status}).`, res.status);
  }
  return data;
}

/** Runs fn(token). Refreshes the token and retries once on a 401. */
async function withTumblrToken(userId, fn) {
  let token = await getValidToken(userId);
  try {
    return await fn(token);
  } catch (err) {
    if (err.status !== 401) throw err;
    token = await getValidToken(userId, { forceRefresh: true });
    try {
      return await fn(token);
    } catch (retryErr) {
      if (retryErr.status === 401) {
        await markNeedsReauth(userId);
        throw new TumblrError(
          'Your Tumblr connection expired. Reconnect to keep posting.',
          401,
          'reauth_required',
        );
      }
      throw retryErr;
    }
  }
}

async function createPost(accessToken, blog, post, publishOn) {
  const body = {
    content: post.content,
    tags: post.tags.join(','),
    state: publishOn ? 'queue' : post.state, // publish_on only works with state 'queue'
  };
  if (publishOn) body.publish_on = publishOn.toISOString();

  const data = await tumblrFetch(accessToken, `/blog/${encodeURIComponent(blog)}/posts`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const id = data.response?.id_string ?? data.response?.id;
  return { id: id != null ? String(id) : undefined };
}

const publishToTumblr = ({ userId, blog, post, publishOn }) =>
  withTumblrToken(userId, (token) => createPost(token, blog, post, publishOn));

/* ───────────── route handlers ───────────── */

// POST /api/tumblr/post   body: { blog, post }
async function postNow(req, res) {
  try {
    const userId = getUserId(req);
    const { blog } = req.body;
    await assertBlogOwned(userId, blog);
    const post = sanitizePost(req.body.post);

    const { id } = await publishToTumblr({ userId, blog, post });
    res.json({ ok: true, id });
  } catch (err) {
    if (err.status === 429) {
      return res
        .status(429)
        .json({ error: 'Tumblr rate limit reached. Try again in a few minutes.' });
    }
    sendError(res, err);
  }
}

// POST /api/tumblr/schedule   body: { blog, post, scheduledAt }
async function schedulePost(req, res) {
  try {
    const userId = getUserId(req);
    const { blog, scheduledAt } = req.body;
    await assertBlogOwned(userId, blog);
    const post = sanitizePost(req.body.post);

    if (post.state === 'private') {
      throw badRequest('Private posts can’t be scheduled. Choose “For Everyone” or post now.');
    }

    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) throw badRequest('Pick a valid date and time.');
    if (when.getTime() <= Date.now()) throw badRequest('Pick a date and time in the future.');
    if (when.getTime() > Date.now() + MAX_SCHEDULE_AHEAD_MS)
      throw badRequest('Posts can be scheduled up to a year ahead.');

    const { id } = await publishToTumblr({ userId, blog, post, publishOn: when });
    res.status(201).json({ ok: true, id });
  } catch (err) {
    if (err.status === 429) {
      return res
        .status(429)
        .json({ error: 'Tumblr rate limit reached. Try again in a few minutes.' });
    }
    sendError(res, err);
  }
}

const textPreview = (p) => {
  const blocks = p.content || [];
  const t =
    blocks.find((b) => b.type === 'text' && b.subtype !== 'heading1') ||
    blocks.find((b) => b.type === 'text');
  if (t) return t.text.length > 80 ? `${t.text.slice(0, 80)}…` : t.text;
  return blocks[0] ? `[${blocks[0].type}]` : p.summary || '';
};

// GET /api/tumblr/scheduled?blog=NAME  ->  { items: [{ id, blog, scheduledAt, status, preview }] }
async function listScheduled(req, res) {
  try {
    const userId = getUserId(req);
    const { blog } = req.query;
    await assertBlogOwned(userId, blog);

    const data = await withTumblrToken(userId, (token) =>
      tumblrFetch(token, `/blog/${encodeURIComponent(blog)}/posts/queue?limit=20&npf=true`),
    );

    res.json({
      items: (data.response?.posts || []).map((p) => ({
        id: String(p.id_string ?? p.id),
        blog,
        scheduledAt: p.scheduled_publish_time ? new Date(p.scheduled_publish_time * 1000) : null,
        status: 'pending',
        preview: textPreview(p),
      })),
    });
  } catch (err) {
    sendError(res, err);
  }
}

// DELETE /api/tumblr/scheduled/:id?blog=NAME
async function cancelScheduled(req, res) {
  try {
    const userId = getUserId(req);
    const { blog } = req.query;
    const { id } = req.params;
    if (!/^\d+$/.test(id)) throw new TumblrError('Scheduled post not found.', 404);
    await assertBlogOwned(userId, blog);

    await withTumblrToken(userId, (token) =>
      tumblrFetch(token, `/blog/${encodeURIComponent(blog)}/post/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id }),
      }),
    );
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
}

module.exports = {
  sanitizePost,
  publishToTumblr,
  postNow,
  schedulePost,
  listScheduled,
  cancelScheduled,
};
