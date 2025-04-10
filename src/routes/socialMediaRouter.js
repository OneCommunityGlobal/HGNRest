const express = require('express');
const { createSessionIdForOAuth, getPinterestAccessToken, createPin,checkConnection } = require('../controllers/socialMediaController');


  const socialMediaRouter = express.Router();

  //social media routes
  socialMediaRouter.route('/pinterest/initOAuth').get(createSessionIdForOAuth);
  socialMediaRouter.route('/pinterest/auth').get(getPinterestAccessToken);
  socialMediaRouter.route('/pinterest/createPin').post(createPin);
  socialMediaRouter.route('/pinterest/checkConnection').get(checkConnection);



module.exports = socialMediaRouter;