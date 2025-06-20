console.log('youtubeSocialMediaRouter loaded');
const path = require('path');
const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');

const routes = function () {
  const controller = require('../controllers/youtubeSocialMediaController')();
  const youtubeRouter = express.Router();

  // Configure multer for video file uploads
  const storage = multer.diskStorage({
    destination (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage,
    fileFilter (req, file, cb) {
      if (!file.mimetype.startsWith('video/')) {
        return cb(new Error('Only video files are allowed!'), false);
      }
      cb(null, true);
    },
    limits: {
      fileSize: 1024 * 1024 * 1024 // 1GB max file size
    }
  });

  youtubeRouter.route('/uploadYtVideo')
    .post(authMiddleware, upload.single('video'), controller.uploadVideo);

  youtubeRouter.route('/youtubeUploadHistory')
    .get(authMiddleware, controller.getUploadHistory);

  youtubeRouter.route('/youtubeScheduledUploads')
    .get(authMiddleware, controller.getScheduledUploads);

  return youtubeRouter;
};

module.exports = routes;
