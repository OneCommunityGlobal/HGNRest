const express = require('express');

const router = express.Router();
const xPostController = require('../controllers/xPostController');

// Routes include /x/ prefix to match Mastodon's pattern.
// Vite proxy strips /api, so /api/x/post arrives as /x/post.
// This ensures routes work through both direct and proxied requests.

// Direct posting
router.post('/x/post', xPostController.createPost);

// Scheduled posts
router.post('/x/schedule', xPostController.schedulePost);
router.get('/x/schedule', xPostController.getScheduled);
router.delete('/x/schedule/:id', xPostController.deleteScheduled);

// Post history
router.get('/x/history', xPostController.getHistory);

module.exports = router;
