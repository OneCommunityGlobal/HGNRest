/* eslint-disable quotes */
const express = require('express');
const { OAuth } = require('oauth');

const router = express.Router();

// --- Require these from environment ---
const { PLURK_CONSUMER_KEY, PLURK_CONSUMER_SECRET, PLURK_TOKEN, PLURK_TOKEN_SECRET } = process.env;

// Quick sanity check so we fail fast on misconfig
function requireEnv(name) {
  if (!process.env[name] || !String(process.env[name]).trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
}
['PLURK_CONSUMER_KEY', 'PLURK_CONSUMER_SECRET', 'PLURK_TOKEN', 'PLURK_TOKEN_SECRET'].forEach(
  requireEnv,
);

// OAuth 1.0a client
const oauth = new OAuth(
  'https://www.plurk.com/OAuth/request_token',
  'https://www.plurk.com/OAuth/access_token',
  PLURK_CONSUMER_KEY,
  PLURK_CONSUMER_SECRET,
  '1.0',
  null,
  'HMAC-SHA1',
);

// POST /api/postToPlurk
router.post('/postToPlurk', (req, res) => {
  try {
    const content = (req.body?.content || '').trim();

    if (!content) {
      return res.status(400).json({ error: 'Plurk content cannot be empty.' });
    }
    if (content.length > 360) {
      return res.status(400).json({ error: 'Plurk content must be 360 chars or less.' });
    }

    const url = 'https://www.plurk.com/APP/Timeline/plurkAdd';
    // Default qualifier ":" = “says”
    const params = { content, qualifier: ':' };

    oauth.post(
      url,
      PLURK_TOKEN,
      PLURK_TOKEN_SECRET,
      params,
      'application/x-www-form-urlencoded',
      (err, data) => {
        if (err) {
          // `err` can be object or string; try to surface useful info
          const status = err.statusCode || 500;
          const msg = err.data || err.message || 'Plurk API failed';
          console.error('Plurk API Error:', msg);
          return res.status(status).json({ error: 'Plurk API failed', details: msg });
        }

        try {
          const parsed = JSON.parse(data);
          // Plurk returns a full plurk object; expose minimal fields
          return res.json({
            plurk_id: parsed.plurk_id,
            posted: parsed.posted,
            lang: parsed.lang,
            qualifier: parsed.qualifier,
          });
        } catch (parseErr) {
          console.error('Plurk parse error:', parseErr);
          return res.status(502).json({ error: 'Invalid Plurk response' });
        }
      },
    );
  } catch (e) {
    console.error('Plurk route error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
