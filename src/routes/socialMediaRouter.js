const express = require('express');
const { getTwitterAccessToken, createTweet } = require('../controllers/socialMediaController');

const routes = function () {
  const socialMediaRouter = express.Router();

  socialMediaRouter.route('/getTwitterAccessToken').post(getTwitterAccessToken);
  socialMediaRouter.route('/createTweet').post(createTweet);

  return socialMediaRouter;
};

module.exports = routes;
