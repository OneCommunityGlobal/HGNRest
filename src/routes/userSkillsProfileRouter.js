const express = require('express');

/**
 * Router for user skills profile endpoints
 * Combines user profile data with skills information
 *
 * @param {Object} HgnFormResponses - The HgnFormResponses model
 * @param {Object} UserProfile - The UserProfile model
 * @returns {Object} Express router
 */
const routes = function (HgnFormResponses, UserProfile) {
  const controller = require('../controllers/userSkillsProfileController')(
    HgnFormResponses,
    UserProfile,
  );
  const userSkillsProfileRouter = express.Router();

  // Get comprehensive user profile with skills data
  userSkillsProfileRouter.route('/skills/profile/:userId').get(controller.getUserSkillsProfile);

  return userSkillsProfileRouter;
};

module.exports = routes;
