const express = require('express');

/**
 * Router for user skills profile endpoints
 * Combines user profile data with skills information
 *
 * @param {Object} UserProfile - The UserProfile model
 * @returns {Object} Express router
 */
const routes = function (UserProfile) {

  const controller = require('../controllers/userSkillsProfileController')(
    UserProfile,
  );
  const userSkillsProfileRouter = express.Router();

  // Get comprehensive user profile with skills data
  userSkillsProfileRouter.route('/skills/profile/:userId').get(controller.getUserSkillsProfile);

  // Update followup details of user profile skills
  userSkillsProfileRouter.route('/skills/profile/updateFollowUp/:userId').put(controller.updateUserSkillsProfileFollowUp);

  return userSkillsProfileRouter;
};

module.exports = routes;
