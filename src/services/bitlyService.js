// services/bitlyService.js

const { stringify } = require('querystring');
const { post, get, patch, delete: del } = require('axios');

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
  console.log('GROUPS', groups[0].guid);
  return groups[0].guid;
}

async function getOrgGuid(accessToken) {
  const { data } = await get('https://api-ssl.bitly.com/v4/organizations', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!data.organizations?.length) throw new Error('No organizations found');
  return data.organizations[0].guid;
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

async function fetchQuota(accessToken) {
  if (!accessToken) throw new Error('accessToken required');

  const orgGuid = await getOrgGuid(accessToken);

  const { data } = await get(`https://api-ssl.bitly.com/v4/organizations/${orgGuid}/plan_limits`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const pick = (name) => data.plan_limits.find((p) => p.name === name) ?? { limit: 0, count: 0 };

  const shorten = pick('encodes');
  const qr = pick('qr_codes');

  return {
    shortLinks: {
      total: shorten.limit,
      used: shorten.count,
      remaining: shorten.limit - shorten.count,
    },
    qrCodes: {
      total: qr.limit,
      used: qr.count,
      remaining: qr.limit - qr.count,
    },
  };
}

async function getQrCodeImage(qrCodeId, accessToken, format = 'png') {
  const { data } = await get(
    `https://api-ssl.bitly.com/v4/qr-codes/${qrCodeId}/image?format=${format}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  );

  return data.qr_code_image;
}

async function generateQrCode(bitlinkId) {
  if (!bitlinkId) throw new Error('bitlinkId is required');
  const { accessToken } = getTokens() ?? {};
  if (!accessToken) throw new Error('Not authenticated');

  const quota = await fetchQuota(accessToken);
  if (quota.qrCodes.remaining === 0) {
    throw new Error('QR-code quota exhausted');
  }

  const groupGuid = await getFirstGroupGuid(accessToken);

  const { data: qr } = await post(
    'https://api-ssl.bitly.com/v4/qr-codes',
    {
      title: `QR for ${bitlinkId}`,
      group_guid: groupGuid,
      destination: { bitlink_id: bitlinkId },
    },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const imageData = await getQrCodeImage(qr.qrcode_id, accessToken);

  return { qrCodeId: qr.qrcode_id, imageData };
}

async function updateBitlinkTitle(bitlinkId, title) {
  if (!bitlinkId || !title) throw new Error('bitlinkId and title required');
  const { accessToken } = getTokens() ?? {};
  if (!accessToken) throw new Error('Not authenticated');

  // PATCH /v4/bitlinks/{bitlink}  (Bitly API) :contentReference[oaicite:0]{index=0}
  await patch(
    `https://api-ssl.bitly.com/v4/bitlinks/${bitlinkId}`,
    { title },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return { ok: true };
}

async function deleteBitlink(bitlinkId) {
  const { accessToken } = getTokens() ?? {};
  if (!accessToken) throw new Error('Not authenticated');

  // Bitly: DELETE /v4/bitlinks/{bitlink}
  await del(`https://api-ssl.bitly.com/v4/bitlinks/${bitlinkId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { ok: true };
}

async function deleteQrCode(qrCodeId) {
  const { accessToken } = getTokens() ?? {};
  if (!accessToken) throw new Error('Not authenticated');

  // Bitly: DELETE /v4/qr-codes/{qrcode_id}
  await del(`https://api-ssl.bitly.com/v4/qr-codes/${qrCodeId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { ok: true };
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
  getFirstGroupGuid,
  getOrgGuid,
  generateQrCode,
  getQrCodeImage,
  fetchQuota,
  clearTokens,
  updateBitlinkTitle,
  deleteBitlink,
  deleteQrCode,
};
