// routers/bitlyRouter.js

const express = require('express');
const {
  checkStatus,
  getAuthUrl,
  handleCallback,
  shortenLinkHandler,
  generateQrHandler,
  disconnect,
} = require('../controllers/bitlyController');

const router = express.Router();

router.get('/status', checkStatus);
router.get('/auth-url', getAuthUrl);
router.get('/callback', handleCallback);
router.post('/shorten', shortenLinkHandler);
router.post('/qr', generateQrHandler);
router.get('/logout', disconnect);

module.exports = router;
