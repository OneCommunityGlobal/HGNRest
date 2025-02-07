const express = require('express');
const { createFbPost } = require('../controllers/facebookSocialMediaController');

const routes = function () {
    const socialMediaRouter = express.Router();
 
    
    socialMediaRouter.route('/createFbPost').post(createFbPost);
 
    return socialMediaRouter;
  };
 
  module.exports = routes;

