const express = require('express');

//const { facebookController } = require('../controllers/facebookSocialMediaController');

const routes = function () {
    const controller = require('../controllers/facebookSocialMediaController')()
    const facebookRouter = express.Router();
 
    
    facebookRouter.route('/createFbPost').post(controller.createFbPost);
    facebookRouter.route('/scheduleFbPost').post(controller.scheduleFbPost);
    facebookRouter.route('/posts').post(controller.scheduleFbPost);
    facebookRouter.route('/createFb').post(controller.schedulePostToFb);

    return facebookRouter;
  };
 
  module.exports = routes;

