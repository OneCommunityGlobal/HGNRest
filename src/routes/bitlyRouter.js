// routers/bitlyRouter.js

const express = require('express');
const {
  checkStatus,
  exchangeToken,
  getAuthUrl,
  shortenLinkHandler,
  generateQrHandler,
  disconnect,
  getOverview,
  updateTitleHandler,
  deleteBitlinkHandler,
  deleteQrCodeHandler,
  getQuota,
} = require('../controllers/bitlyController');

const router = express.Router();

router.get('/status', checkStatus);
router.get('/auth-url', getAuthUrl);
router.post('/shorten', shortenLinkHandler);
router.post('/shorten', shortenLinkHandler);
router.post('/exchange', exchangeToken);
router.post('/qr', generateQrHandler);
router.get('/overview', getOverview);
router.get('/quota', getQuota);
router.patch('/bitlink/:id/title', updateTitleHandler);
router.delete('/bitlink/:id', deleteBitlinkHandler);
router.delete('/qrcode/:id', deleteQrCodeHandler);
router.get('/logout', disconnect);

module.exports = router;
