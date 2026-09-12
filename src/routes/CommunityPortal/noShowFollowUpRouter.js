const express = require('express');

const routes = function () {
  const controller = require('../../controllers/CommunityPortal/noShowFollowUpController')();

  const noShowRouter = express.Router();

  noShowRouter.route('/sendFollowUpEmailAll').post(controller.sendFollowUpEmailAll);
  noShowRouter.route('/sendFollowUpEmail').post(controller.sendFollowUpEmail);

  return noShowRouter;
};

module.exports = routes;
