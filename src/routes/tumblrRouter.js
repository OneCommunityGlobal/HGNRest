const express = require('express');
const auth = require('../controllers/tumblrAuthController');
const post = require('../controllers/tumblrPostController');

const router = express.Router();

router.get('/auth/tumblr/start', auth.start);
router.get('/auth/tumblr/callback', auth.callback);

router.get('/tumblr/status', auth.status);
router.post('/tumblr/disconnect', auth.disconnect);

router.post('/tumblr/post', post.postNow);
router.post('/tumblr/schedule', post.schedulePost);
router.get('/tumblr/scheduled', post.listScheduled);
router.delete('/tumblr/scheduled/:id', post.cancelScheduled);

module.exports = router;
