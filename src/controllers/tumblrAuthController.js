const crypto = require('crypto');
const { TumblrConnection, encrypt, decrypt } = require('../models/tumblrConnection');

/*
 * Env:
 *   TUMBLR_CLIENT_ID, TUMBLR_CLIENT_SECRET
 *   TUMBLR_REDIRECT_URI   e.g. http://localhost:4500/api/auth/tumblr/callback (must match the Tumblr app registration exactly)
 *   OAUTH_STATE_SECRET    long random string used to sign the OAuth `state` value
 *   FRONTEND_URL          e.g. https://app.yourapp.com
 *   TUMBLR_RETURN_PATH    optional, where to land after auth (default "/")
 *   TOKEN_ENC_KEY         see models/tumblrConnection.js
 */
const AUTHORIZE_URL = 'https://www.tumblr.com/oauth2/authorize';
const TOKEN_URL = 'https://api.tumblr.com/v2/oauth2/token';
const USER_INFO_URL = 'https://api.tumblr.com/v2/user/info';
const SCOPES = 'basic write offline_access';

const EXPIRY_SKEW_MS = 60 * 1000; // refresh a minute early
const BLOGS_STALE_MS = 60 * 60 * 1000; // re-fetch blog list at most hourly

/* ───────────── shared error type ───────────── */

class TumblrError extends Error {
  constructor(message, statusCode = 500, code = undefined) {
    super(message);
    this.name = 'TumblrError';
    this.status = statusCode;
    this.code = code;
  }
}

const getUserId = (req) => {
  const id = req.user?.requestorId || req.user?.id || req.user?._id;
  if (!id) throw new TumblrError('Not signed in.', 401, 'unauthenticated');
  return id;
};

const sendError = (res, err) => {
  if (err instanceof TumblrError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error('[tumblr:auth]', err);
  return res.status(500).json({ error: 'Something went wrong. Try again.' });
};

const frontendRedirect = (res, result) => {
  const origin = process.env.FRONTEND_URL;
  if (!origin) return res.status(500).send('FRONTEND_URL is not configured on the server.');
  const base = `${origin}${process.env.TUMBLR_RETURN_PATH || '/announcements/tumblr'}`;
  const sep = base.includes('?') ? '&' : '?';
  return res.redirect(`${base}${sep}tumblr=${result}`);
};

/* ───────────── Tumblr HTTP helpers ───────────── */

async function requestToken(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: process.env.TUMBLR_CLIENT_ID,
      client_secret: process.env.TUMBLR_CLIENT_SECRET,
      ...params,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new TumblrError(
      data.error_description || data.error || `Tumblr token request failed (${res.status})`,
      res.status,
      data.error,
    );
  }
  return data;
}

async function fetchUserInfo(accessToken) {
  const res = await fetch(USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new TumblrError(
      data?.meta?.msg || `Couldn't load Tumblr account (${res.status})`,
      res.status,
    );
  }
  const user = data.response?.user || {};
  return {
    username: user.name,
    blogs: (user.blogs || []).map((b) => ({ name: b.name, title: b.title, uuid: b.uuid })),
  };
}

function applyTokens(connection, data) {
  connection.accessTokenEnc = encrypt(data.access_token);
  // Tumblr may rotate the refresh token; keep the old one if none is returned
  if (data.refresh_token) connection.refreshTokenEnc = encrypt(data.refresh_token);
  connection.expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  if (data.scope) connection.scope = data.scope;
  connection.needsReauth = false;
}

/* ───────────── token access (used by the post controller + job) ───────────── */

// One in-flight refresh per user, so concurrent calls don't burn a rotating refresh token twice.
// This is per-process; with multiple server instances, add a Mongo-based lock if you see races.
const refreshLocks = new Map();

async function refreshTokens(connection) {
  const key = String(connection.userId);
  if (refreshLocks.has(key)) return refreshLocks.get(key);

  const promise = (async () => {
    try {
      const data = await requestToken({
        grant_type: 'refresh_token',
        refresh_token: decrypt(connection.refreshTokenEnc),
      });
      applyTokens(connection, data);
      await connection.save();
      return connection;
    } catch (err) {
      if (err.status === 400 || err.status === 401) {
        connection.needsReauth = true;
        await connection.save();
        throw new TumblrError(
          'Your Tumblr connection expired. Reconnect to keep posting.',
          401,
          'reauth_required',
        );
      }
      throw err;
    } finally {
      refreshLocks.delete(key);
    }
  })();

  refreshLocks.set(key, promise);
  return promise;
}

async function markNeedsReauth(userId) {
  await TumblrConnection.updateOne({ userId }, { $set: { needsReauth: true } });
}

async function getValidToken(userId, { forceRefresh = false } = {}) {
  let connection = await TumblrConnection.findOne({ userId });
  if (!connection || connection.needsReauth) {
    throw new TumblrError(
      'Tumblr is not connected. Connect your account to continue.',
      401,
      'reauth_required',
    );
  }
  if (forceRefresh || connection.expiresAt.getTime() - EXPIRY_SKEW_MS < Date.now()) {
    connection = await refreshTokens(connection);
  }
  return decrypt(connection.accessTokenEnc);
}

/* ───────────── signed OAuth state ─────────────
 * The browser hits /callback via a redirect from Tumblr, so no Authorization header (and possibly
 * no session) is available. The user is identified by a signed, short-lived `state` instead, and
 * the nonce inside it must match an httpOnly cookie set when the flow started.
 */
const STATE_TTL_MS = 10 * 60 * 1000;
const NONCE_COOKIE = 'tumblr_oauth_nonce';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax', // sent on the top-level redirect back from Tumblr
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

const hmac = (body) =>
  crypto.createHmac('sha256', process.env.OAUTH_STATE_SECRET).update(body).digest('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(body)}`;
}

function verifyState(state) {
  if (typeof state !== 'string') return null;
  const [body, sig] = state.split('.');
  if (!body || !sig || !safeEqual(sig, hmac(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/* ───────────── route handlers ───────────── */

// GET /api/auth/tumblr/start   (authenticated)  ->  { url }
// Called with fetch so your normal auth header is sent; the frontend then navigates to `url`.
async function start(req, res) {
  try {
    const userId = getUserId(req);
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = signState({ uid: String(userId), nonce, exp: Date.now() + STATE_TTL_MS });

    res.cookie(NONCE_COOKIE, nonce, { ...cookieOptions(), maxAge: STATE_TTL_MS });

    const params = new URLSearchParams({
      client_id: process.env.TUMBLR_CLIENT_ID,
      response_type: 'code',
      scope: SCOPES,
      state,
      redirect_uri: process.env.TUMBLR_REDIRECT_URI,
    });
    res.json({ url: `${AUTHORIZE_URL}?${params}` });
  } catch (err) {
    sendError(res, err);
  }
}

// GET /api/auth/tumblr/callback
async function callback(req, res) {
  try {
    const { code, state, error } = req.query;

    const payload = verifyState(state);
    const cookieNonce = readCookie(req, NONCE_COOKIE);
    res.clearCookie(NONCE_COOKIE, cookieOptions()); // single use

    if (!payload || !cookieNonce || !safeEqual(cookieNonce, payload.nonce)) {
      return frontendRedirect(res, 'error');
    }
    if (error) return frontendRedirect(res, 'denied');
    if (typeof code !== 'string') return frontendRedirect(res, 'error');

    const userId = payload.uid;

    const tokens = await requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.TUMBLR_REDIRECT_URI,
    });
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new TumblrError(
        'Tumblr did not return a refresh token. Check the offline_access scope.',
        502,
      );
    }

    const info = await fetchUserInfo(tokens.access_token);

    const connection =
      (await TumblrConnection.findOne({ userId })) ||
      new TumblrConnection({
        userId,
        accessTokenEnc: 'x',
        refreshTokenEnc: 'x',
        expiresAt: new Date(),
      });
    applyTokens(connection, tokens);
    connection.tumblrUsername = info.username;
    connection.blogs = info.blogs;
    connection.blogsUpdatedAt = new Date();
    await connection.save();

    return frontendRedirect(res, 'connected');
  } catch (err) {
    console.error('[tumblr:callback]', err);
    return frontendRedirect(res, 'error');
  }
}

// GET /api/tumblr/status  ->  { connected, needsReauth?, username?, blogs }
async function status(req, res) {
  try {
    const userId = getUserId(req);
    const connection = await TumblrConnection.findOne({ userId });

    if (!connection || connection.needsReauth) {
      return res.json({
        connected: false,
        needsReauth: Boolean(connection?.needsReauth),
        blogs: [],
      });
    }

    // Pick up blogs created after connecting; fall back to the stored list on any failure
    const stale =
      !connection.blogsUpdatedAt ||
      Date.now() - connection.blogsUpdatedAt.getTime() > BLOGS_STALE_MS;
    if (stale) {
      try {
        const token = await getValidToken(userId);
        const info = await fetchUserInfo(token);
        connection.blogs = info.blogs;
        connection.blogsUpdatedAt = new Date();
        await connection.save();
      } catch (err) {
        if (err.code === 'reauth_required') {
          return res.json({ connected: false, needsReauth: true, blogs: [] });
        }
        /* otherwise keep stored blogs */
      }
    }

    return res.json({
      connected: true,
      username: connection.tumblrUsername,
      blogs: connection.blogs.map((b) => ({ name: b.name, title: b.title })),
    });
  } catch (err) {
    sendError(res, err);
  }
}

// POST /api/tumblr/disconnect
// Removes tokens locally. Posts already queued on Tumblr stay queued; the user can manage them on Tumblr.
async function disconnect(req, res) {
  try {
    const userId = getUserId(req);
    await TumblrConnection.deleteOne({ userId });
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
}

module.exports = {
  TumblrError,
  getUserId,
  sendError,
  fetchUserInfo,
  getValidToken,
  markNeedsReauth,
  start,
  callback,
  status,
  disconnect,
};
