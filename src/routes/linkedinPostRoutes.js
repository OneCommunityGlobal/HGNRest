const express = require('express');

const routes = () => {
  const controller = require('../controllers/linkedinPostController')();
  const linkedinRouter = express.Router();
  linkedinRouter.route('/postToLinkedIn').post(controller.postToLinkedin);

  return linkedinRouter;
};

module.exports = routes;
