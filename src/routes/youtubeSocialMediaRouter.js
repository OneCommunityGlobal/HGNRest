console.log('youtubeSocialMediaRouter loaded');
const express = require('express');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');

const routes = function () {
  const controller = require('../controllers/youtubeSocialMediaController')();
  const youtubeRouter = express.Router();

  // Configure multer for video file uploads
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
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

  return youtubeRouter;
};

module.exports = routes;
