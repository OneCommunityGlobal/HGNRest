var express = require('express');


var routes = function (userProfile) {

  var controller = require('../controllers/userProfileController')(userProfile);

  var userProfileRouter = express.Router();
  userProfileRouter.route('/userProfile')
    .get(controller.getUserProfiles)
    .post(controller.postUserProfile);


    userProfileRouter.route('/userProfile/:userId')
    .get(controller.getUserById)
    .put(controller.putUserProfile);


  return userProfileRouter;

};



module.exports = routes;
