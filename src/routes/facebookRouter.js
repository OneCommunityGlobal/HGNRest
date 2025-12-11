const express = require('express');
const { postToFacebook } = require('../controllers/facebookController');

const routes = function () {
  const router = express.Router();

  router.route('/social/facebook/post').post(postToFacebook);

  return router;
};

module.exports = routes;
