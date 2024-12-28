const express = require('express');
const multer = require('multer');

const routes = () => {
  // Configure multer
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: {
      fileSize: 200 * 1024 * 1024, // 200MB max file size
      files: 9, // Maximum 9 files
    },
  });

  const controller = require('../controllers/linkedinPostController')();
  const linkedinRouter = express.Router();

  // Add multer middleware to handle multipart/form-data
  linkedinRouter.route('/postToLinkedIn').post(
    upload.array('media', 9), // Handle up to 9 media files
    (req, res, next) => {
      // Log received data for debugging
      console.log('Received request:', {
        body: req.body,
        files: req.files?.map((f) => ({
          name: f.originalname,
          type: f.mimetype,
          size: f.size,
        })),
      });
      next();
    },
    controller.postToLinkedin,
  );

  return linkedinRouter;
};

module.exports = routes;
