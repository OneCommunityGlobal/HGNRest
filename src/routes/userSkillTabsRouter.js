const express = require('express');

const userSkillTabsRouter = (HgnFormResponses) => {
  const controller = require('../controllers/userSkillTabsController')(HgnFormResponses);
  const router = express.Router();

  router.get('/profile/:userId/dashboard', controller.dashboard);
  router.get('/profile/:userId/frontend', controller.frontend);
  router.get('/profile/:userId/backend', controller.backend);
  router.get('/profile/:userId/deployment&devops', controller.devops);
  router.get('/profile/:userId/softwarepractices', controller.softwarePractices);

  return router;
};

module.exports = userSkillTabsRouter;
