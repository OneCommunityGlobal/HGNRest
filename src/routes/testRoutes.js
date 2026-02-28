const express = require('express');

const router = express.Router();

router.post('/set-team-code', async (req, res) => {
  try {
    const userProfile = require('../models/userProfile');
    const { userId, teamCode } = req.body;

    if (!userId || !teamCode) {
      return res.status(400).json({ error: 'userId and teamCode required' });
    }

    const updated = await userProfile.findByIdAndUpdate(userId, { teamCode }, { new: true });

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
