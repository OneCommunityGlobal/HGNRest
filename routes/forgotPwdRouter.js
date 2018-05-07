var express = require('express');
var forgotPwdRouter = express.Router();


var router = function (userProfile) {
   
    var controller = require('../controllers/forgotPwdcontroller')(userProfile);

    forgotPwdRouter.route('/forgotpassword')
        .post(controller.forgotPwd);

    return forgotPwdRouter;

};

module.exports = router;
