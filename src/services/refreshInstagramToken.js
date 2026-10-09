// services/instagram/refreshInstagramToken.js
const axios = require('axios');
const MetaToken = require('../models/metaToken');

// only call Meta when the token is this close to expiry
const REFRESH_WINDOW_DAYS = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function refreshInstagramToken() {
  const tokenDoc = await MetaToken.findOne({ platform: 'instagram' });
  if (!tokenDoc) throw new Error('No Instagram token found — run bootstrap script first.');

  // plenty of time left, so skip the call. If expiresAt is missing,
  // msLeft is NaN, the comparison is false, and the code refreshes anyway.
  const msLeft = tokenDoc.expiresAt - Date.now();
  if (msLeft > REFRESH_WINDOW_DAYS * MS_PER_DAY) {
    return { tokenDoc, refreshed: false };
  }
  let response;
  try {
    response = await axios.get(`https://graph.facebook.com/v23.0/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: tokenDoc.accessToken,
      },
      timeout: 15000,
    });
  } catch (err) {
    const message = err?.response?.data?.error?.message || err?.message || 'Unknown error';
    throw new Error(`Instagram token refresh failed: ${message}`);
  }

  // Never save an invalid or already-expired date if Meta omits expires_in
  const data = response?.data;
  const expiresIn = data?.expires_in;
  if (!data?.access_token || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Instagram token refresh failed: response had no access_token or expires_in.');
  }

  tokenDoc.accessToken = data.access_token;
  tokenDoc.expiresAt = new Date(Date.now() + expiresIn * 1000);
  tokenDoc.lastRefreshedAt = new Date();
  await tokenDoc.save();

  return { tokenDoc, refreshed: true };
}

module.exports = refreshInstagramToken;
