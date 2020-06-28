const express = require('express');


const routes = function (userProfile) {
  const controller = require('../controllers/userProfileController')(userProfile);

  const userProfileRouter = express.Router();

  userProfileRouter.route('/userProfile')
    .get(controller.getUserProfiles)
    .post(controller.postUserProfile);

  userProfileRouter.route('/userProfile/:userId')
    .get(controller.getUserById)
    .put(controller.putUserProfile)
    .delete(controller.deleteUserProfile)
    .patch(controller.changeUserStatus);

  userProfileRouter.route('/userProfile/name/:name')
    .get(controller.getUserByName);

  userProfileRouter.route('/userProfile/reportees/:userId')
    .get(controller.getreportees);

  userProfileRouter.route('/userProfile/teammembers/:userId')
    .get(controller.getTeamMembersofUser);

  userProfileRouter.route('/userProfile/:userId/updatePassword')
    .patch(controller.updatepassword);

  userProfileRouter.route('/userProfile/:userId/resetPassword')
    .patch(controller.resetPassword);

  userProfileRouter.route('/userProfile/name/:userId')
    .get(controller.getUserName);

  userProfileRouter.route('/userProfile/project/:projectId')
    .get(controller.getProjectMembers);

  return userProfileRouter;
};


module.exports = routes;
