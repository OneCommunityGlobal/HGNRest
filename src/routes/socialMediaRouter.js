const express = require('express');
const { getPinterestAccessToken, createPin } = require('../controllers/socialMediaController');

const routes = function () {
  const socialMediaRouter = express.Router();

  socialMediaRouter.route('/getPinterestAccessToken').post(getPinterestAccessToken);
  socialMediaRouter.route('/createPin').post(createPin);

  return socialMediaRouter;
};

module.exports = routes;
