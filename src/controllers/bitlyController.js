const axios = require('axios');
const {
  generateAuthUrl,
  exchangeCodeForToken,
  getTokens,
  shortenLink,
  generateQrCode,
  fetchQuota,
  clearTokens,
  getFirstGroupGuid,
  getQrCodeImage,
  updateBitlinkTitle,
  deleteBitlink,
  deleteQrCode,
} = require('../services/bitlyService');

/** 1) GET /api/bitly/status */
function checkStatus(req, res) {
  try {
    const tokens = getTokens();
    return res.json({ connected: Boolean(tokens && tokens.accessToken) });
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

/** 3) /** POST /api/bitly/exchange */
async function exchangeToken(req, res) {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    await exchangeCodeForToken(code); // your existing helper
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/** 4) POST /api/bitly/shorten */
async function shortenLinkHandler(req, res) {
  try {
    const tokens = getTokens();
    if (!tokens || !tokens.accessToken) return res.status(401).json({ error: 'Not authenticated' });
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
    if (!tokens || !tokens.accessToken) return res.status(401).json({ error: 'Not authenticated' });
    const { bitlinkId } = req.body;
    if (!bitlinkId) return res.status(400).json({ error: 'bitlinkId is required' });
    const qr = await generateQrCode(bitlinkId);
    return res.send(qr);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate QR', details: err.message });
  }
}

// 6) GET /api/bitly/overview
async function getOverview(req, res) {
  try {
    // 1) Ensure the user is connected
    const tokens = getTokens();
    if (!tokens || !tokens.accessToken) {
      return res.status(401).json({ error: 'Not authenticated with Bitly' });
    }
    const { accessToken } = tokens;

    // 2) Lookup the user’s first group GUID
    const groupGuid = await getFirstGroupGuid(accessToken);

    // 3) Fetch all bitlinks in that group
    const bitlinksResp = await axios.get(
      `https://api-ssl.bitly.com/v4/groups/${groupGuid}/bitlinks`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const bitlinks = bitlinksResp.data.links || [];

    // 4) Fetch all QR codes in that group
    const {
      data: { qr_codes: qrCodes = [] },
    } = await axios.get(`https://api-ssl.bitly.com/v4/groups/${groupGuid}/qr-codes`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 4b) Pull each thumbnail (concurrently but safely)
    const qrCodesWithImages = await Promise.all(
      qrCodes.map(async (q) => ({
        qrCodeId: q.qrcode_id,
        bitlinkId: q.bitlink_id,
        created_at: q.created,
        imageData: await getQrCodeImage(q.qrcode_id, accessToken),
      })),
    );

    // 5) Respond with counts + sanitized lists
    res.json({
      totalShortened: bitlinks.length,
      totalQrCodes: qrCodes.length,
      bitlinks: bitlinks.map((b) => ({
        id: b.id,
        link: b.link,
        title: b.title || '',
        long_url: b.long_url,
        created_at: b.created_at,
      })),
      qrCodes: qrCodesWithImages,
    });
  } catch (err) {
    console.error('Error fetching Bitly overview:', err);
    res.status(500).json({
      error: 'Failed to fetch overview',
      details: err.message,
    });
  }
}

// 6) GET /api/bitly/quota
async function getQuota(req, res) {
  try {
    const { accessToken } = getTokens() ?? {};
    if (!accessToken) {
      return res.status(401).json({ error: 'Not authenticated with Bitly' });
    }

    const quota = await fetchQuota(accessToken);
    return res.json(quota);
  } catch (err) {
    console.error('Error fetching quota:', err);
    res.status(500).json({ error: 'Failed to fetch quota', details: err.message });
  }
}

/** PATCH /api/bitly/bitlink/:id/title  { title } */
async function updateTitleHandler(req, res) {
  const { id } = req.params;
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Missing title' });

  try {
    await updateBitlinkTitle(id, title); // ← new service fn
    res.json({ ok: true });
  } catch (err) {
    console.error('Update title failed:', err);
    res.status(500).json({ error: err.message });
  }
}

async function deleteBitlinkHandler(req, res) {
  try {
    await deleteBitlink(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete bitlink failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/** DELETE /api/bitly/qrcode/:id */
async function deleteQrCodeHandler(req, res) {
  try {
    await deleteQrCode(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete QR failed:', err);
    res.status(500).json({ error: err.message });
  }
}

/** 7) GET /api/bitly/logout */
function disconnect(req, res) {
  const cleared = clearTokens();
  if (!cleared) return res.status(400).json({ error: 'No Bitly connection to clear' });
  return res.json({ disconnected: true });
}

module.exports = {
  checkStatus,
  getAuthUrl,
  exchangeToken,
  shortenLinkHandler,
  generateQrHandler,
  getOverview,
  updateTitleHandler,
  deleteBitlinkHandler,
  deleteQrCodeHandler,
  disconnect,
  getQuota,
};
