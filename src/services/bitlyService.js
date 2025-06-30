// services/bitlyService.js

const { stringify } = require('querystring');
const { post, get } = require('axios');

let _tokens = null;
const { BITLY_CLIENT_ID, BITLY_CLIENT_SECRET, BITLY_REDIRECT_URI } = process.env;

function generateAuthUrl() {
  const qs = stringify({
    client_id: BITLY_CLIENT_ID,
    redirect_uri: BITLY_REDIRECT_URI,
  });
  return `https://bitly.com/oauth/authorize?${qs}`;
}

async function exchangeCodeForToken(code) {
  const payload = stringify({
    client_id: BITLY_CLIENT_ID,
    client_secret: BITLY_CLIENT_SECRET,
    code,
    redirect_uri: BITLY_REDIRECT_URI,
  });
  const resp = await post('https://api-ssl.bitly.com/oauth/access_token', payload, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
  });

  // rename to camelCase locally
  const { access_token: accessToken } = resp.data;
  if (!accessToken) throw new Error('No access_token returned');
  _tokens = { accessToken };
  return _tokens;
}

function getTokens() {
  return _tokens;
}

async function getFirstGroupGuid(accessToken) {
  const resp = await get('https://api-ssl.bitly.com/v4/groups', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const groups = resp.data.groups || [];
  if (groups.length === 0) throw new Error('No groups found');
  return groups[0].guid;
}

async function shortenLink(longUrl) {
  if (!longUrl) throw new Error('longUrl is required');
  const tokens = getTokens();
  if (!tokens || !tokens.accessToken) throw new Error('Not authenticated');
  const groupGuid = await getFirstGroupGuid(tokens.accessToken);

  const resp = await post(
    'https://api-ssl.bitly.com/v4/shorten',
    {
      // quote the API’s snake_case key
      group_guid: groupGuid,
      domain: 'bit.ly',
      long_url: longUrl,
    },
    { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
  );
  return resp.data;
}

async function generateQrCode(bitlinkId) {
  if (!bitlinkId) throw new Error('bitlinkId is required');
  const tokens = getTokens();
  if (!tokens || !tokens.accessToken) throw new Error('Not authenticated');
  const groupGuid = await getFirstGroupGuid(tokens.accessToken);

  const qrResp = await post(
    'https://api-ssl.bitly.com/v4/qr-codes',
    {
      title: `QR for ${bitlinkId}`,
      group_guid: groupGuid,
      destination: { bitlink_id: bitlinkId },
    },
    { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
  );
  // rename locally
  const { qrcode_id: qrCodeId } = qrResp.data;
  if (!qrCodeId) throw new Error('Failed to get qrcode_id');

  const imageResp = await get(`https://api-ssl.bitly.com/v4/qr-codes/${qrCodeId}/image`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
    responseType: 'arraybuffer',
  });
  return { mimeType: imageResp.headers['content-type'], data: imageResp.data };
}

function clearTokens() {
  if (!_tokens) return false;
  _tokens = null;
  return true;
}

module.exports = {
  generateAuthUrl,
  exchangeCodeForToken,
  getTokens,
  shortenLink,
  generateQrCode,
  clearTokens,
};
