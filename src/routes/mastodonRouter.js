const express = require('express');
const {
  createPin,
  schedulePin,
  fetchScheduledPin,
  deletedScheduledPin,
  fetchPostHistory,
} = require('../controllers/mastodonPostController');
const requireSocialPublishingPermission = require('../middleware/requireSocialPublishingPermission');

const mastodonRouter = express.Router();
mastodonRouter.use('/mastodon', requireSocialPublishingPermission);

mastodonRouter.post('/mastodon/createPin', createPin);
mastodonRouter.post('/mastodon/schedule', schedulePin);
mastodonRouter.get('/mastodon/schedule', fetchScheduledPin);
mastodonRouter.delete('/mastodon/schedule/:id', deletedScheduledPin);
mastodonRouter.get('/mastodon/history', fetchPostHistory);

module.exports = mastodonRouter;
