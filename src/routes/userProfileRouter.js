const { body } = require('express-validator');

const express = require('express');
const { ValidationError } = require('../utilities/errorHandling/customError');

const routes = function (userProfile) {
  const controller = require('../controllers/userProfileController')(userProfile);

  const userProfileRouter = express.Router();

  userProfileRouter
    .route('/userProfile')
    .get(controller.getUserProfiles)
    .post(
      body('firstName').customSanitizer((value) => {
        if (!value) throw new ValidationError('First Name is required');
        return value.trim();
      }),
      body('lastName').customSanitizer((value) => {
        if (!value) throw new ValidationError('Last Name is required');
        return value.trim();
      }),
      controller.postUserProfile,
    );

  userProfileRouter
    .route('/userProfile/:userId')
    .get(controller.getUserById)
    .put(
      body('firstName').customSanitizer((value) => {
        if (!value) throw new ValidationError('First Name is required');
        return value.trim();
      }),
      body('lastName').customSanitizer((value) => {
        if (!value) throw new ValidationError('Last Name is required');
        return value.trim();
      }),
      body('personalLinks').customSanitizer((value) =>
        value.map((link) => {
          if (link.Name.replace(/\s/g, '') || link.Link.replace(/\s/g, '')) {
            return {
              ...link,
              Name: link.Name.trim(),
              Link: link.Link.replace(/\s/g, ''),
            };
          }
          throw new ValidationError('personalLinks not valid');
        }),
      ),
      body('adminLinks').customSanitizer((value) =>
        value.map((link) => {
          if (link.Name.replace(/\s/g, '') || link.Link.replace(/\s/g, '')) {
            return {
              ...link,
              Name: link.Name.trim(),
              Link: link.Link.replace(/\s/g, ''),
            };
          }
          throw new ValidationError('adminLinks not valid');
        }),
      ),
      controller.putUserProfile,
    )
    .delete(controller.deleteUserProfile)
    .patch(controller.changeUserStatus);

  userProfileRouter.route('/userProfile/name/:name').get(controller.getUserByName);

  userProfileRouter
    .route('/userProfile/:userId/rehireable')
    .patch(controller.changeUserRehireableStatus);

  userProfileRouter
    .route('/userProfile/singleName/:singleName')
    .get(controller.getUserBySingleName);

  userProfileRouter.route('/userProfile/fullName/:fullName').get(controller.getUserByFullName);

  userProfileRouter.route('/refreshToken/:userId').get(controller.refreshToken);

  userProfileRouter.route('/userProfile/reportees/:userId').get(controller.getreportees);

  userProfileRouter.route('/userProfile/teammembers/:userId').get(controller.getTeamMembersofUser);

  userProfileRouter.route('/userProfile/:userId/property').patch(controller.updateOneProperty);

  userProfileRouter.route('/AllTeamCodeChanges').patch(controller.updateAllMembersTeamCode);

  userProfileRouter.route('/userProfile/:userId/updatePassword').patch(controller.updatepassword);

  userProfileRouter.route('/userProfile/:userId/resetPassword').patch(controller.resetPassword);

  userProfileRouter.route('/userProfile/name/:userId').get(controller.getUserName);

  userProfileRouter.route('/userProfile/project/:projectId').get(controller.getProjectMembers);

  userProfileRouter
    .route('/userProfile/socials/facebook')
    .get(controller.getAllUsersWithFacebookLink);

  userProfileRouter
    .route('/userProfile/authorizeUser/weeeklySummaries')
    .post(controller.authorizeUser);

  userProfileRouter.route('/userProfile/projects/:name').get(controller.getProjectsByPerson);

  return userProfileRouter;
};

module.exports = routes;
