// services/instagram/refreshInstagramToken.js
const axios = require('axios');
const MetaToken = require('../models/metaToken');

async function refreshInstagramToken() {
  const tokenDoc = await MetaToken.findOne({ platform: 'instagram' });
  if (!tokenDoc) throw new Error('No Instagram token found — run bootstrap script first.');

  const { data } = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: tokenDoc.accessToken,
    },
  });

  tokenDoc.accessToken = data.access_token;
  tokenDoc.expiresAt = new Date(Date.now() + data.expires_in * 1000);
  tokenDoc.lastRefreshedAt = new Date();
  await tokenDoc.save();

  return tokenDoc;
}

module.exports = refreshInstagramToken;
