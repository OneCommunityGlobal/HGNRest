// routers/bitlyRouter.js
const express = require('express');
const bitlyController = require('../controllers/bitlyController');

const router = express.Router();

// 1) Check whether the user has connected their Bitly account:
router.get('/status', bitlyController.checkStatus);

// 2) Get the URL your front-end should redirect the user to:
router.get('/auth-url', bitlyController.getAuthUrl);

// 3) Bitly’s OAuth callback (Bitly will redirect here with ?code=…&state=…):
router.get('/callback', bitlyController.handleCallback);

// 4) Shorten a URL (expects JSON { longUrl: 'https://…' }):
router.post('/shorten', bitlyController.shortenLink);

// 5) Generate a QR code (expects JSON { bitlinkId: 'bit.ly/abc123' }):
router.post('/qr', bitlyController.generateQr);

module.exports = router;
