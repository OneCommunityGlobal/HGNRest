const express = require('express');
const {
  postToFacebook,
  scheduleFacebookPost,
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

const routes = function () {
  const router = express.Router();

  // ============================================
  // Auth / Connection routes
  // ============================================
  router.route('/social/facebook/auth/status').get(getConnectionStatus);
  router.route('/social/facebook/auth/callback').post(handleAuthCallback);
  router.route('/social/facebook/auth/connect').post(connectPage);
  router.route('/social/facebook/auth/disconnect').post(disconnectPage);
  router.route('/social/facebook/auth/verify').post(verifyConnection);

  // ============================================
  // Posting routes
  // ============================================
  router.route('/social/facebook/post').post(postToFacebook);
  router.route('/social/facebook/schedule').post(scheduleFacebookPost);

  // ============================================
  // Scheduled posts management
  // ============================================
  router.route('/social/facebook/scheduled').get(getScheduledPosts);
  router
    .route('/social/facebook/schedule/:postId')
    .delete(cancelScheduledPost)
    .put(updateScheduledPost);

  // ============================================
  // Post history
  // ============================================
  router.route('/social/facebook/history').get(getPostHistory);

  return router;
};

module.exports = routes;
