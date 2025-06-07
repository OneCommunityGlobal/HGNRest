// controllers/bitlyController.js

const {
  getTokens,
  generateAuthUrlService,
  exchangeCodeForTokenService,
  shortenLinkService,
  generateQrCodeService
} = require('../services/bitlyService');

//
// 1) checkStatus → returns { connected: true/false } based on stored tokens
//
export function checkStatus(req, res) {
  try {
    const tokens = getTokens();
    if (!tokens || !tokens.access_token) {
      return res.json({ connected: false });
    }
    return res.json({ connected: true });
  } catch (err) {
    console.error('Error in checkStatus:', err.message);
    return res.status(500).json({ error: 'Failed to check Bitly status' });
  }
}

//
// 2) getAuthUrl → returns the URL your front-end should redirect the user to
//
export function getAuthUrl(req, res) {
  try {
    const url = generateAuthUrlService();
    // (If you want to keep a state value for CSRF, you could store it in session here.)
    return res.json({ url });
  } catch (err) {
    console.error('Error generating auth URL:', err.message);
    return res.status(500).json({ error: 'Failed to generate Bitly auth URL' });
  }
}

//
// 3) handleCallback → Bitly will redirect here with ?code=...&state=...
//
export async function handleCallback(req, res) {
  const { code } = req.query;

  try {
    if (!code) {
      throw new Error('Missing code from Bitly callback');
    }
    // (Optional) If you generated a state in getAuthUrl, verify it against session here.

    // Exchange “code” for access_token & store it in your service
    const token = await exchangeCodeForTokenService(code);

    // Redirect back to your front-end. For example:
    // return res.redirect(`https://sabithanazareth.github.io?bitly=success`);
    return res.json({token})
  } catch (err) {
    console.error('Bitly callback error:', err.message);
    const msg = encodeURIComponent(err.message);
    return res.redirect(`http://sabithanazareth.github.io?bitly=error&error=${msg}`);
  }
}

//
// 4) shortenLink → POST /bitly/shorten { longUrl: 'https://...' }
//
//    Checks that the user is “connected” (i.e. getTokens().access_token exists),
//    then calls the service helper to actually shorten the URL.
//
export async function shortenLink(req, res) {
  try {
    const tokens = getTokens();
    if (!tokens || !tokens.access_token) {
      return res.status(401).json({ error: 'Not authenticated with Bitly' });
    }

    const { longUrl } = req.body;
    if (!longUrl) {
      return res.status(400).json({ error: 'longUrl is required' });
    }

    // Call the service method (renamed to avoid collision)
    const shortened = await shortenLinkService(longUrl);
    // Example response: { id: 'bit.ly/abc123', link: 'https://bit.ly/abc123', … }
    return res.json(shortened);
  } catch (err) {
    console.error('Error in shortenLink:', err.message);
    return res.status(500).json({ error: 'Failed to shorten URL', details: err.message });
  }
}

//
// 5) generateQr → POST /bitly/qr { bitlinkId: 'bit.ly/abc123' }
//
//    Similar pattern: verify tokens, then call the service helper.
//
export async function generateQr(req, res) {
  try {
    const tokens = getTokens();
    if (!tokens || !tokens.access_token) {
      return res.status(401).json({ error: 'Not authenticated with Bitly' });
    }

    const { bitlinkId } = req.body;
    if (!bitlinkId) {
      return res.status(400).json({ error: 'bitlinkId is required' });
    }

    // Call the service method (renamed to avoid collision)
    const qrObj = await generateQrCodeService(bitlinkId);
    // qrObj = { mimeType: 'image/svg+xml', data: <Buffer> }

    // Return raw image buffer
    res.set('Content-Type', qrObj.mimeType);
    return res.send(qrObj.data);
  } catch (err) {
    console.error('Error in generateQr:', err.message);
    return res
      .status(500)
      .json({ error: 'Failed to generate QR code', details: err.message });
  }
}
