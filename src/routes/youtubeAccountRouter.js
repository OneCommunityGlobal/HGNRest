const express = require('express');
const { getAllYoutubeAccounts } = require('../utilities/youtubeAccountUtil');

const router = express.Router();

router.get('/youtubeAccounts', async (req, res) => {
  try {
    const accounts = await getAllYoutubeAccounts();
    res.json(accounts.map(acc => ({
      id: acc._id,
      displayName: acc.displayName,
      channelId: acc.channelId
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

module.exports = router; 