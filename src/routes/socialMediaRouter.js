const express = require('express');
const {
  getTwitterAccessToken,
  createTweet,
  scheduleTweet,
} = require('../controllers/socialMediaController');

const routes = function () {
  const socialMediaRouter = express.Router();

  socialMediaRouter.route('/getTwitterAccessToken').post(getTwitterAccessToken);
  socialMediaRouter.route('/createTweet').post(createTweet);
  socialMediaRouter.route('/scheduleTweet').post(scheduleTweet);

  return socialMediaRouter;
};

module.exports = routes;
