const express = require('express');

const routes = function (ProfileInitialSetupToken, userProfile, Project, mapLocations) {
    const ProfileInitialSetup = express.Router();
    const controller = require('../controllers/profileInitialSetupController')(ProfileInitialSetupToken, userProfile, Project, mapLocations);
    ProfileInitialSetup.route('/getInitialSetuptoken')
        .post(controller.getSetupToken);
    ProfileInitialSetup.route('/ProfileInitialSetup').post(controller.setUpNewUser);
    ProfileInitialSetup.route('/validateToken').post(controller.validateSetupToken);
    ProfileInitialSetup.route('/getTimeZoneAPIKeyByToken').post(controller.getTimeZoneAPIKeyByToken);
    ProfileInitialSetup.route('/getTotalCountryCount').get(controller.getTotalCountryCount);
    ProfileInitialSetup.route('/getSetupInvitation').get(controller.getSetupInvitation);
    ProfileInitialSetup.route('/refreshSetupInvitationToken').post(controller.refreshSetupInvitation);
    ProfileInitialSetup.route('/cancelSetupInvitationToken').post(controller.cancelSetupInvitation);
    return ProfileInitialSetup;
};

module.exports = routes;
