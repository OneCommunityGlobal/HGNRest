const express = require('express');

const routes = function () {
  const controller = require('../controllers/youtubeSocialMediaController')()
  const youtubeRouter = express.Router();


  youtubeRouter.route('/uploadYtVideo').post(controller.uploadVideo);

  return youtubeRouter;
};

module.exports = routes;
