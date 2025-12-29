const { OAuth } = require('oauth');

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
  '1.0a',
  null,
  'HMAC-SHA1',
  32,
  {
    Accept: '*/*',
    Connection: 'close',
    'User-Agent': 'Node authentication',
    'Content-Type': 'application/x-www-form-urlencoded',
  },
);

const postToPlurk = (content) =>
  new Promise((resolve, reject) => {
    if (!content) {
      reject(new Error('Plurk content cannot be empty.'));
      return;
    }
    if (content.length > 360) {
      reject(new Error('Plurk content must be 360 chars or less.'));
      return;
    }

    const url = 'https://www.plurk.com/APP/Timeline/plurkAdd';
    const params = {
      content,
      qualifier: ':',
      lang: 'en',
    };

    oauth.post(
      url,
      PLURK_TOKEN,
      PLURK_TOKEN_SECRET,
      params,
      'application/x-www-form-urlencoded',
      (err, data) => {
        if (err) {
          console.error('Plurk API Error Details:', {
            statusCode: err.statusCode,
            data: err.data,
            message: err.message,
            requestUrl: url,
            hasToken: !!PLURK_TOKEN,
            hasTokenSecret: !!PLURK_TOKEN_SECRET,
            requestBody: params,
            headers: err.headers,
          });
          return reject(err);
        }

        try {
          const parsed = JSON.parse(data);
          console.log('Plurk posted successfully:', parsed);
          return resolve(parsed);
        } catch (parseErr) {
          console.error('Plurk parse error:', parseErr);
          return reject(new Error('Invalid Plurk response'));
        }
      },
    );
  });

module.exports = {
  postToPlurk,
};
