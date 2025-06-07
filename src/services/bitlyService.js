const { post, get } = require('axios');
const { stringify } = require('querystring');

let _tokens = null;

const {
  BITLY_CLIENT_ID,
  BITLY_CLIENT_SECRET,
  BITLY_REDIRECT_URI,
} = process.env;

/**
 * 1) Construct the “redirect to Bitly” URL
 */
export function generateAuthUrlService() {
  const base = 'https://bitly.com/oauth/authorize';
  const params = {
    client_id: BITLY_CLIENT_ID,
    redirect_uri: BITLY_REDIRECT_URI,
  };
  const qs = stringify(params);
  return `${base}?${qs}`;
}

/**
 * 2) Exchange an authorization code for tokens
 */
export async function exchangeCodeForTokenService(code) {
  const url = 'https://api-ssl.bitly.com/oauth/access_token';
  const payload = stringify({
    client_id: BITLY_CLIENT_ID,
    client_secret: BITLY_CLIENT_SECRET,
    code,
    redirect_uri: BITLY_REDIRECT_URI,
  });
  // Request JSON so we can parse access_token easily
  const response = await post(url, payload, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
  });
  const { access_token } = response.data;
  if (!access_token) {
    throw new Error('No access_token returned from Bitly');
  }
  // Store it in our in‐memory “DB”
  _tokens = { access_token };
  return _tokens;
}

/**
 * 3) Get the stored tokens
 */
export function getTokens() {
  return _tokens;
}

/**
 * 4) Fetch the first group_guid (every Bitly user belongs to ≥1 group)
 */
async function getFirstGroupGuid(accessToken) {
  const resp = await get('https://api-ssl.bitly.com/v4/groups', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const groups = resp.data.groups;
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error('No Bitly groups found for this user.');
  }
  return groups[0].guid;
}

/**
 * 5) Shorten a long URL
 */
export async function shortenLinkService(longUrl) {
  if (!longUrl) throw new Error('longUrl is required');
  const tokens = getTokens();
  if (!tokens || !tokens.access_token) {
    throw new Error('Not authenticated with Bitly');
  }
  const accessToken = tokens.access_token;
  const groupGuid = await getFirstGroupGuid(accessToken);

  const resp = await post(
    'https://api-ssl.bitly.com/v4/shorten',
    {
      group_guid: groupGuid,
      domain: 'bit.ly',
      long_url: longUrl,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  // resp.data has { id: "bit.ly/abc123", link: "https://bit.ly/abc123", … }
  return resp.data;
}

/**
 * 6) Generate a QR code for a Bitlink
 */
export async function generateQrCodeService(bitlinkId) {
  if (!bitlinkId) throw new Error('bitlinkId is required');
  const tokens = getTokens();
  if (!tokens || !tokens.access_token) {
    throw new Error('Not authenticated with Bitly');
  }
  const accessToken = tokens.access_token;
  const groupGuid = await getFirstGroupGuid(accessToken);

  // Create the QR code entry
  const qrResp = await post(
    'https://api-ssl.bitly.com/v4/qr-codes',
    {
      title: `QR for ${bitlinkId}`,
      group_guid: groupGuid,
      destination: { bitlink_id: bitlinkId },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const { qrcode_id } = qrResp.data;
  if (!qrcode_id) {
    throw new Error('Failed to get qrcode_id');
  }

  // Fetch the raw SVG (default) or PNG if you add ?format=png
  const imageResp = await get(
    `https://api-ssl.bitly.com/v4/qr-codes/${qrcode_id}/image`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
    }
  );

  return {
    mimeType: imageResp.headers['content-type'],
    data: imageResp.data, // Buffer
  };
}

