const express = require('express');

const routes = () => {
  const controller = require('../controllers/redditPostController')();
  const redditRouter = express.Router();

  // Auth endpoints
  redditRouter.route('/auth/login').get(controller.redditLogin);
  redditRouter.route('/auth/token').get(controller.isRedditTokenExists);

  redditRouter.route('/submit-post').post(controller.submitRedditPost);
  redditRouter.route('/post/schedule').post(controller.scheduleRedditPost);
  redditRouter.route('/post').get(controller.listRedditPost);
  redditRouter.route('/post/:id').delete(controller.deleteRedditPost);
  redditRouter.route('/post/:id').get(controller.getRedditPostById);
  redditRouter.route('/post/:id').put(controller.updateScheduledPost);
  redditRouter.route('/posts/action/auto-submit').get(controller.submitScheduledPosts);

  return redditRouter;
};

module.exports = routes;
