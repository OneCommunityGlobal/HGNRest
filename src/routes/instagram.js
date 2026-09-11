const express = require('express');

const router = express.Router();

const {
  createPost,
  schedulePost,
  getScheduledPosts,
  deleteScheduledPost,
  getHistory,
  retryScheduledPost,
} = require('../controllers/instagramController');

router.post(
  '/post',
  // auth,
  createPost,
);

router.post(
  '/schedule',
  // auth,
  schedulePost,
);

router.get(
  '/schedule',
  // auth,
  getScheduledPosts,
);

router.delete(
  '/schedule/:id',
  // auth,
  deleteScheduledPost,
);

router.post(
  '/schedule/:id/retry',
  // auth,
  retryScheduledPost,
);

router.get(
  '/history',
  // auth,
  getHistory,
);

module.exports = router;
