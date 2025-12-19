const express = require('express');
const {
  postToFacebook,
  scheduleFacebookPost,
  getScheduledPosts,
  getPostHistory,
  cancelScheduledPost,
  updateScheduledPost,
} = require('../controllers/facebookController');

const routes = function () {
  const router = express.Router();

  // Existing routes
  router.route('/social/facebook/post').post(postToFacebook);
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
