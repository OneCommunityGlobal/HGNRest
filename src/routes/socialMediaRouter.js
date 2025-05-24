const express = require('express');
const {
  getTwitterAccessToken,
  createTweet,
  scheduleTweet,
  getPosts,
  deletePosts,
  updatePosts,
} = require('../controllers/socialMediaController');

const routes = function () {
  const socialMediaRouter = express.Router();

  socialMediaRouter.route('/getTwitterAccessToken').post(getTwitterAccessToken);
  socialMediaRouter.route('/createTweet').post(createTweet);
  socialMediaRouter.route('/scheduleTweet').post(scheduleTweet);
  socialMediaRouter.route('/getPosts').get(getPosts);
  socialMediaRouter.route('/deletePosts').delete(deletePosts);

  socialMediaRouter.route('/posts').post(scheduleTweet);
  socialMediaRouter.route('/posts').delete(deletePosts);
  socialMediaRouter.route('/posts').get(getPosts);
  socialMediaRouter.route('/posts').put(updatePosts);

  return socialMediaRouter;
};

module.exports = routes;
