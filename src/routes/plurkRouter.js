import express from 'express';
import OAuth from 'oauth';

const router = express.Router();

// these should come from env vars
const { PLURK_CONSUMER_KEY } = process.env;
const { PLURK_CONSUMER_SECRET } = process.env;
const { PLURK_TOKEN } = process.env;
const { PLURK_TOKEN_SECRET } = process.env;

const oauth = new OAuth.OAuth(
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
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Empty Plurk content' });
  }

  const url = 'https://www.plurk.com/APP/Timeline/plurkAdd';
  const params = { content, qualifier: ':' }; // ":" = default qualifier

  oauth.post(
    url,
    PLURK_TOKEN,
    PLURK_TOKEN_SECRET,
    params,
    'application/x-www-form-urlencoded',
    (err, data) => {
      if (err) {
        console.error('Plurk API Error:', err);
        return res.status(500).json({ error: 'Plurk API failed' });
      }

      try {
        const parsed = JSON.parse(data);
        return res.json({ plurk_id: parsed.plurk_id, response: parsed });
      } catch (parseErr) {
        console.error('Parse error:', parseErr);
        return res.status(500).json({ error: 'Invalid Plurk response' });
      }
    },
  );
});

export default router;
