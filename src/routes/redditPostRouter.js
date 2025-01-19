const express = require('express');
const multer = require('multer');

const routes = () => {

    console.log("✅ Reddit Post Router is loaded!");

  // Configure multer for handling file uploads
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: {
      fileSize: 200 * 1024 * 1024, // Max file size: 200MB
      files: 9, // Max number of files: 9
    },
  });

  const redditPostController = require('../controllers/redditPostControllers')();  // Ensure correct import
  const redditRouter = express.Router();

  // Route for posting to Reddit (with optional scheduling)
  redditRouter.route('/postToReddit').post(
    upload.array('media', 9), // Handle up to 9 media files
    (req, res, next) => {
      if (req.body.scheduleTime) {
        req.body.scheduleTime = new Date(req.body.scheduleTime);
      }

      // Log received data for debugging
      console.log('Received request:', {
        body: req.body,
        scheduleTime: req.body.scheduleTime,
        files: req.files?.map((f) => ({
          name: f.originalname,
          type: f.mimetype,
          size: f.size,
        })),
      });
      next();
    },
    redditPostController.postToReddit,  
  );

  // Route for retrieving all scheduled posts
  redditRouter.route('/scheduledPosts').get(redditPostController.getScheduledPosts);

  return redditRouter;
};

module.exports = routes;