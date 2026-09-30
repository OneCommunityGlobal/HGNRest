const express = require('express');
const {
  createPin,
  schedulePin,
  fetchScheduledPin,
  deletedScheduledPin,
  fetchPostHistory,
} = require('../controllers/mastodonPostController');
const { hasPermission } = require('../utilities/permissions');

const mastodonRouter = express.Router();

// Posting to Mastodon uses the organization's account, so only people who
// can send announcements (the same permission as the Announcements page)
// may use these routes.
async function requireAnnouncementsPermission(req, res, next) {
  try {
    if (await hasPermission(req.body?.requestor, 'sendEmails')) return next();
    return res.status(403).json({ error: 'You are not authorized to post to Mastodon.' });
  } catch (err) {
    console.error('Mastodon permission check failed:', err.message);
    return res.status(500).json({ error: 'Failed to check permissions.' });
  }
}

mastodonRouter.use('/mastodon', requireAnnouncementsPermission);

mastodonRouter.post('/mastodon/createPin', createPin);
mastodonRouter.post('/mastodon/schedule', schedulePin);
mastodonRouter.get('/mastodon/schedule', fetchScheduledPin);
mastodonRouter.delete('/mastodon/schedule/:id', deletedScheduledPin);
mastodonRouter.get('/mastodon/history', fetchPostHistory);

module.exports = mastodonRouter;
