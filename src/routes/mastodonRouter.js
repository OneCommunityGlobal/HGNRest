const express = require('express');
const { createPin, schedulePin, fetchScheduledPin, deletedScheduledPin } = require('../controllers/mastodonPostController');


  const mastodonRouter = express.Router();

  mastodonRouter.route('/mastodon/createPin').post(createPin);
  mastodonRouter.route('/mastodon/schedule').post(schedulePin);
  mastodonRouter.route('/mastodon/schedule').get(fetchScheduledPin);
  mastodonRouter.route('/mastodon/schedule/:id').delete(deletedScheduledPin);

module.exports = mastodonRouter;