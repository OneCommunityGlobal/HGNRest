const express = require('express');

const router = express.Router();
const controller = require('../controllers/truthSocialPostController');

// Proxy post to Truth Social (avoids CORS)
router.post('/post', controller.createPost);

// Verify token
router.post('/verify', controller.verifyToken);

// History
router.post('/history', controller.saveHistory);
router.get('/history', controller.getPostHistory);

// Scheduling (stored for manual posting)
router.post('/schedule', controller.schedulePost);
router.get('/schedule', controller.getScheduledPosts);
router.delete('/schedule/:id', controller.deleteScheduledPost);
router.put('/schedule/:id', controller.updateScheduledPost);

module.exports = router;