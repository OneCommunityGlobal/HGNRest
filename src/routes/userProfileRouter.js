import { body } from 'express-validator';

const express = require('express');

const routes = function (userProfile) {
  const controller = require('../controllers/userProfileController')(
    userProfile,
  );

  const userProfileRouter = express.Router();

  userProfileRouter
    .route('/userProfile')
    .get(controller.getUserProfiles)
    .post(
      body('firstName').customSanitizer(value => value.trim()),
      body('lastName').customSanitizer(value => value.trim()),
      controller.postUserProfile,
    );

  userProfileRouter
    .route('/userProfile/:userId')
    .get(controller.getUserById)
    .put(
      body('firstName').customSanitizer(value => value.trim()),
      body('lastName').customSanitizer(value => value.trim()),
      body('personalLinks').customSanitizer(value => value.map((link) => {
          if (link.Name.replace(/\s/g, '') || link.Link.replace(/\s/g, '')) {
            return {
              ...link,
              Name: link.Name.trim(),
              Link: link.Link.replace(/\s/g, ''),
            };
          }
          throw new Error('Url not valid');
        })),
      body('adminLinks').customSanitizer(value => value.map((link) => {
          if (link.Name.replace(/\s/g, '') || link.Link.replace(/\s/g, '')) {
            return {
              ...link,
              Name: link.Name.trim(),
              Link: link.Link.replace(/\s/g, ''),
            };
          }
          throw new Error('Url not valid');
        })),
      controller.putUserProfile,
    )
    .delete(controller.deleteUserProfile)
    .patch(controller.changeUserStatus);

  userProfileRouter
    .route('/userProfile/name/:name')
    .get(controller.getUserByName);

  userProfileRouter
    .route('/userProfile/singleName/:singleName')
    .get(controller.getUserBySingleName);

  userProfileRouter
    .route('/userProfile/fullName/:fullName')
    .get(controller.getUserByFullName);

  userProfileRouter.route('/refreshToken/:userId').get(controller.refreshToken);

  userProfileRouter
    .route('/userProfile/reportees/:userId')
    .get(controller.getreportees);

  userProfileRouter
    .route('/userProfile/teammembers/:userId')
    .get(controller.getTeamMembersofUser);

  userProfileRouter
    .route('/userProfile/:userId/property')
    .patch(controller.updateOneProperty);

  userProfileRouter
    .route('/userProfile/:userId/updatePassword')
    .patch(controller.updatepassword);

  userProfileRouter
    .route('/userProfile/:userId/resetPassword')
    .patch(controller.resetPassword);

  userProfileRouter
    .route('/userProfile/name/:userId')
    .get(controller.getUserName);

  userProfileRouter
    .route('/userProfile/project/:projectId')
    .get(controller.getProjectMembers);

  userProfileRouter
    .route('/userProfile/socials/facebook')
    .get(controller.getAllUsersWithFacebookLink);

  return userProfileRouter;
};

module.exports = routes;
