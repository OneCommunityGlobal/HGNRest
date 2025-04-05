const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const config = require('../config');

const routes = () => {
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: {
      fileSize: 200 * 1024 * 1024, // 200MB max file size
      files: 9, // Maximum 9 files
    },
  });

  const controller = require('../controllers/redditPostControllers')();
  const redditRouter = express.Router();

  // Add authorization middleware to all Reddit routes
  redditRouter.use((req, res, next) => {
    const authToken = req.header('Authorization');
    if (!authToken) {
      return res.status(401).json({ error: 'Unauthorized request' });
    }

    try {
      const token = authToken.replace('Bearer ', '');
      const decoded = jwt.verify(token, config.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Handle post creation and scheduling
  redditRouter.post('/post', upload.array('media', 9), controller.postToReddit);

  // Get scheduled posts
  redditRouter.get('/scheduled', controller.getScheduledPosts);

  // Cancel scheduled post
  redditRouter.delete('/scheduled/:jobId', controller.cancelScheduledPost);

  return redditRouter;
};

module.exports = routes;
