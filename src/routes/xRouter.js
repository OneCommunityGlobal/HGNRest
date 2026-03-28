const express = require('express');

const router = express.Router();
const xPostController = require('../controllers/xPostController');

// Router is mounted at /x, so paths here are just the suffix.

// Direct posting
router.post('/post', xPostController.createPost);

// Scheduled posts
router.post('/schedule', xPostController.schedulePost);
router.get('/schedule', xPostController.getScheduled);
router.delete('/schedule/:id', xPostController.deleteScheduled);
router.put('/schedule/:id', xPostController.updateScheduledPost);
router.patch('/schedule/:id/mark-posted', xPostController.markAsPosted);
router.patch('/schedule/:id/skip', xPostController.skipPost);

// Post history
router.get('/history', xPostController.getHistory);

module.exports = router;
