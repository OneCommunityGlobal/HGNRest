const express = require('express');
const { getPinterestAccessToken, createPin } = require('../controllers/socialMediaController');


  const socialMediaRouter = express.Router();

  // socialMediaRouter.route('/getPinterestAccessToken').post(getPinterestAccessToken);
  socialMediaRouter.route('/pinterest/auth').post(getPinterestAccessToken);
  socialMediaRouter.route('/pinterest/createPin').post(createPin);



module.exports = socialMediaRouter;