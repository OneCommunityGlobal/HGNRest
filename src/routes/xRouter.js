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

// Post history
router.get('/history', xPostController.getHistory);

module.exports = router;
