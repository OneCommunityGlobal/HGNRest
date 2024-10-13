const express = require('express');
const {
  getPinterestAccessToken,
  getTwitterAccessToken,
  createPin,
  createTweet,
} = require('../controllers/socialMediaController');

const routes = function () {
  const socialMediaRouter = express.Router();

  socialMediaRouter.route('/getPinterestAccessToken').post(getPinterestAccessToken);
  socialMediaRouter.route('/getTwitterAccessToken').post(getTwitterAccessToken);
  socialMediaRouter.route('/createPin').post(createPin);
  socialMediaRouter.route('/createTweet').post(createTweet);

  return socialMediaRouter;
};

module.exports = routes;
