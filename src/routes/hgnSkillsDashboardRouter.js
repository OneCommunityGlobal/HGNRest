const express = require('express');

const routes = function (UserProfile) {
  const controller = require('../controllers/hgnSkillsDashboardController')(UserProfile);
  const hgnSkillsDashboardRouter = express.Router();

  hgnSkillsDashboardRouter.route('/checkPermission/:userId')
    .get(controller.checkDashboardAccess);

  return hgnSkillsDashboardRouter;
};

module.exports = routes; 