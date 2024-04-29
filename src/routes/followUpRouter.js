const express = require('express');

const routes = function (followUp) {
  const followUpRouter = express.Router();
  const controller = require('../controllers/followUpController')(followUp);

  followUpRouter.route('/followup').get(controller.getFollowups);

  followUpRouter.route('/followup/:userId/:taskId').post(controller.setFollowUp);

  return followUpRouter;
};

module.exports = routes;
