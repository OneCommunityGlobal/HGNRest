// const express = require('express');
// const {
//   createPin,
//   schedulePin,
//   fetchScheduledPin,
//   deletedScheduledPin,
// } = require('../controllers/mastodonPostController');

// const mastodonRouter = express.Router();

// mastodonRouter.post('/mastodon/createPin', createPin);
// mastodonRouter.post('/mastodon/schedule', schedulePin);
// mastodonRouter.get('/mastodon/schedule', fetchScheduledPin);
// mastodonRouter.delete('/mastodon/schedule/:id', deletedScheduledPin);

// module.exports = mastodonRouter;
const express = require('express');
const {
  createPin,
  schedulePin,
  fetchScheduledPin,
  deletedScheduledPin,
  fetchPostHistory,
} = require('../controllers/mastodonPostController');

const mastodonRouter = express.Router();

mastodonRouter.post('/mastodon/createPin', createPin);
mastodonRouter.post('/mastodon/schedule', schedulePin);
mastodonRouter.get('/mastodon/schedule', fetchScheduledPin);
mastodonRouter.delete('/mastodon/schedule/:id', deletedScheduledPin);
mastodonRouter.get('/mastodon/history', fetchPostHistory);

module.exports = mastodonRouter;
