const express = require('express');
const multer = require('multer');
const {
  postToFacebook,
  postToFacebookWithImage,
  scheduleFacebookPost,
  scheduleFacebookPostWithImage,
  getScheduledPosts,
  getPostHistory,
  cancelScheduledPost,
  updateScheduledPost,
} = require('../controllers/facebookController');
const {
  getConnectionStatus,
  handleAuthCallback,
  connectPage,
  disconnectPage,
  verifyConnection,
} = require('../controllers/facebookAuthController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'), false);
    }
  },
});

const routes = function () {
  const router = express.Router();

  // Auth and connection routes
  router.route('/social/facebook/auth/status').get(getConnectionStatus);
  router.route('/social/facebook/auth/callback').post(handleAuthCallback);
  router.route('/social/facebook/auth/connect').post(connectPage);
  router.route('/social/facebook/auth/disconnect').post(disconnectPage);
  router.route('/social/facebook/auth/verify').post(verifyConnection);

  // Posting routes
  router
    .route('/social/facebook/post/upload')
    .post(upload.single('image'), postToFacebookWithImage);
  router.route('/social/facebook/post').post(postToFacebook);

  // Scheduling routes
  router
    .route('/social/facebook/schedule/upload')
    .post(upload.single('image'), scheduleFacebookPostWithImage);
  router.route('/social/facebook/schedule').post(scheduleFacebookPost);

  // Scheduled posts management
  router.route('/social/facebook/scheduled').get(getScheduledPosts);
  router
    .route('/social/facebook/schedule/:postId')
    .delete(cancelScheduledPost)
    .put(updateScheduledPost);

  // Post history
  router.route('/social/facebook/history').get(getPostHistory);

  return router;
};

module.exports = routes;
