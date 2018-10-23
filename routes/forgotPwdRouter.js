var express = require('express');

var router = function (userProfile) {
    var forgotPwdRouter = express.Router();   
    var controller = require('../controllers/forgotPwdcontroller')(userProfile);
    forgotPwdRouter.route('/forgotpassword')
        .post(controller.forgotPwd);

    return forgotPwdRouter;

};
    
module.exports = router;
