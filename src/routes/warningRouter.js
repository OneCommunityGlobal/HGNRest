const express = require('express');

const routes = function (userProfile) {
  const controller = require('../controllers/warningsController')(userProfile);

  const warningRouter = express.Router();

  warningRouter
    .route('/warnings/:userId')
    .get(controller.getWarningsByUserId)
    .post(controller.postWarningsToUserProfile)
    .delete(controller.deleteUsersWarnings);

  warningRouter.route('/warnings/:userId/special').get(controller.getSpecialWarnings);

  warningRouter.route('/warnings/:userId/new').post(controller.postNewWarningsByUserId);

  return warningRouter;
};
module.exports = routes;
