const crypto = require('crypto');
const fetch = require('node-fetch');
const OAuth = require('oauth-1.0a');
const XScheduledPost = require('../models/xScheduledPost');
const XPostHistory = require('../models/xPostHistory');

const X_API_BASE = 'https://api.x.com/2';

/**
 * Build OAuth 1.0a credentials from env vars.
 * These tokens do NOT expire, making them ideal for shared-account automation.
 * Future: replace with per-user OAuth 2.0 + PKCE token lookup.
 */
function getOAuthCredentials() {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
    throw new Error(
      'X OAuth credentials not configured. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET in .env',
    );
  }
  return {
    consumer: { key: X_API_KEY, secret: X_API_SECRET },
    token: { key: X_ACCESS_TOKEN, secret: X_ACCESS_TOKEN_SECRET },
  };
}

/**
 * Generate OAuth 1.0a Authorization header for a given request.
 */
function getOAuthHeader(url, method) {
  const creds = getOAuthCredentials();
  const oauth = OAuth({
    consumer: creds.consumer,
    signature_method: 'HMAC-SHA1',
    hash_function: (baseString, key) =>
      crypto.createHmac('sha1', key).update(baseString).digest('base64'),
  });
  return oauth.toHeader(oauth.authorize({ url, method }, creds.token));
}

/**
 * Post content to X via the v2 tweets endpoint.
 * Returns { success, data, error } to keep controller logic clean.
 */
async function postToX(content) {
  const url = `${X_API_BASE}/tweets`;
  const authHeader = getOAuthHeader(url, 'POST');
  const requestBody = JSON.stringify({ text: content });
  console.log('[X API] Request:', {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: requestBody,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: requestBody,
  });
  const body = await res.json();
  console.log('[X API] Response:', { status: res.status, body });
  if (!res.ok) {
    const msg = body?.detail || body?.errors?.[0]?.message || `X API error ${res.status}`;
    return { success: false, data: null, error: msg };
  }
  return { success: true, data: body.data, error: null };
}

/**
 * POST /x/post
 * Immediately post to X and record history.
 */
async function createPost(req, res) {
  console.log('X credentials loaded:', {
    key: process.env.X_API_KEY?.slice(0, 5),
    secret: process.env.X_API_SECRET?.slice(0, 5),
    token: process.env.X_ACCESS_TOKEN?.slice(0, 5),
    tokenSecret: process.env.X_ACCESS_TOKEN_SECRET?.slice(0, 5),
  });
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }
    if (content.length > 280) {
      return res.status(400).json({ error: 'Content exceeds 280 character limit' });
    }
    const result = await postToX(content);
    const historyEntry = await XPostHistory.create({
      content,
      xPostId: result.data?.id || null,
      status: result.success ? 'posted' : 'failed',
      source: 'direct',
      errorMessage: result.error,
      postedAt: result.success ? new Date() : null,
      createdBy: req.body.requestor?.requestorId || null,
    });
    if (!result.success) {
      return res
        .status(502)
        .json({
          error: 'Failed to post to X',
          detail: result.error,
          raw: JSON.stringify(result.error?.response?.data || result.error?.data || result.error),
          historyId: historyEntry._id,
        });
    }
    return res
      .status(201)
      .json({
        message: 'Posted to X successfully',
        xPostId: result.data.id,
        historyId: historyEntry._id,
      });
  } catch (error) {
    console.error('X post error:', error);
    console.error(
      'X API status:',
      error?.response?.status,
      'headers:',
      JSON.stringify(error?.response?.headers),
    );
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /x/schedule
 * Save a post for future delivery by the scheduler job.
 */
async function schedulePost(req, res) {
  try {
    const { content, scheduledAt } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }
    if (content.length > 280) {
      return res.status(400).json({ error: 'Content exceeds 280 character limit' });
    }
    const scheduleDate = new Date(scheduledAt);
    if (Number.isNaN(scheduleDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt date' });
    }
    if (scheduleDate <= new Date()) {
      return res.status(400).json({ error: 'scheduledAt must be in the future' });
    }
    const scheduled = await XScheduledPost.create({
      content,
      scheduledAt: scheduleDate,
      createdBy: req.body.requestor?.requestorId || null,
    });
    return res.status(201).json({ message: 'Post scheduled', scheduledPost: scheduled });
  } catch (err) {
    console.error('xPostController.schedulePost error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /x/schedule
 * Retrieve all pending scheduled posts.
 */
async function getScheduled(req, res) {
  try {
    const posts = await XScheduledPost.find({ status: 'scheduled' })
      .sort({ scheduledAt: 1 })
      .lean();
    return res.status(200).json(posts);
  } catch (err) {
    console.error('xPostController.getScheduled error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /x/schedule/:id
 * Cancel a pending scheduled post.
 */
async function deleteScheduled(req, res) {
  try {
    const post = await XScheduledPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Scheduled post not found' });
    }
    if (post.status !== 'scheduled') {
      return res.status(400).json({ error: `Cannot delete post with status "${post.status}"` });
    }
    await post.deleteOne();
    return res.status(200).json({ message: 'Scheduled post deleted' });
  } catch (err) {
    console.error('xPostController.deleteScheduled error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /x/history
 * Retrieve post history with optional filters.
 * Query params: status, source, limit, skip
 */
async function getHistory(req, res) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.source) filter.source = req.query.source;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = parseInt(req.query.skip, 10) || 0;
    const [posts, total] = await Promise.all([
      XPostHistory.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip).lean(),
      XPostHistory.countDocuments(filter),
    ]);
    return res.status(200).json({ posts, total });
  } catch (err) {
    console.error('xPostController.getHistory error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { createPost, schedulePost, getScheduled, deleteScheduled, getHistory, postToX };
