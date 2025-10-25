const express = require('express');
const router = express.Router();

const routes = function () {
  const controller = require('../controllers/communityController')();

  const communityRouter = express.Router();

  // Route: /hgnhelp/community
  communityRouter.route('/community')
    .get(controller.getCommunityMembers);

  return communityRouter;
};

module.exports = routes;
