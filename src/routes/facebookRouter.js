const express = require('express');
const { postToFacebook, scheduleFacebookPost } = require('../controllers/facebookController');

const routes = function () {
  const router = express.Router();

  router.route('/social/facebook/post').post(postToFacebook);
  router.route('/social/facebook/schedule').post(scheduleFacebookPost);

  return router;
};

module.exports = routes;
