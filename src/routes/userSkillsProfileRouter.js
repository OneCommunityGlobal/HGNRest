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

  // Add a debug route to test basic connectivity
  userSkillsProfileRouter.route('/skills').get((req, res) => {
    res.status(200).json({
      message: 'Debug route working',
      authenticated: req.user ? true : false,
      user: req.user
        ? {
            id: req.user.userid || req.user.userID || req.user._id,
            email: req.user.email,
            role: req.user.role,
          }
        : null,
    });
  });

  // // Get comprehensive user profile with skills data
  // userSkillsProfileRouter.route('/skills/profile/:userId').get(controller.getUserSkillsProfile);

  // // Get all team members with their skills
  // userSkillsProfileRouter
  //   .route('/skills/team-profiles/:teamName')
  //   .get(controller.getTeamMembersSkillsProfiles);

  // // Find users by skill criteria
  // userSkillsProfileRouter.route('/skills/find-by-skills').get(controller.findUsersBySkills);

  return userSkillsProfileRouter;
};

module.exports = routes;
