// controllers/bitlyController.js

const {
  generateAuthUrl,
  exchangeCodeForToken,
  getTokens,
  shortenLink,
  generateQrCode,
  clearTokens,
} = require('../services/bitlyService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/** 1) GET /api/bitly/status */
function checkStatus(req, res) {
  try {
    const tokens = getTokens();
    return res.json({ connected: Boolean(tokens && tokens.access_token) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to check status' });
  }
}

/** 2) GET /api/bitly/auth-url */
function getAuthUrl(req, res) {
  try {
    const url = generateAuthUrl();
    return res.json({ url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate auth URL' });
  }
}

/** 3) GET /api/bitly/callback?code=...&state=... */
async function handleCallback(req, res) {
  const { code, state } = req.query;
  try {
    if (!code) throw new Error('Missing code');
    await exchangeCodeForToken(code);
    const redirectUrl = new URL(FRONTEND_URL);
    redirectUrl.searchParams.set('bitly', 'success');
    if (state) redirectUrl.searchParams.set('state', state);
    return res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error(err);
    const redirectUrl = new URL(FRONTEND_URL);
    redirectUrl.searchParams.set('bitly', 'error');
    redirectUrl.searchParams.set('error', err.message);
    return res.redirect(redirectUrl.toString());
  }
}

/** 4) POST /api/bitly/shorten */
async function shortenLinkHandler(req, res) {
  try {
    const tokens = getTokens();
    if (!tokens || !tokens.access_token)
      return res.status(401).json({ error: 'Not authenticated' });
    const { longUrl } = req.body;
    if (!longUrl) return res.status(400).json({ error: 'longUrl is required' });
    const data = await shortenLink(longUrl);
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to shorten URL', details: err.message });
  }
}

/** 5) POST /api/bitly/qr */
async function generateQrHandler(req, res) {
  try {
    const tokens = getTokens();
    if (!tokens || !tokens.access_token)
      return res.status(401).json({ error: 'Not authenticated' });
    const { bitlinkId } = req.body;
    if (!bitlinkId) return res.status(400).json({ error: 'bitlinkId is required' });
    const qr = await generateQrCode(bitlinkId);
    res.set('Content-Type', qr.mimeType);
    return res.send(qr.data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate QR', details: err.message });
  }
}

/** 6) GET /api/bitly/logout */
function disconnect(req, res) {
  const cleared = clearTokens();
  if (!cleared) return res.status(400).json({ error: 'No Bitly connection to clear' });
  return res.json({ disconnected: true });
}

module.exports = {
  checkStatus,
  getAuthUrl,
  handleCallback,
  shortenLinkHandler,
  generateQrHandler,
  disconnect,
};
