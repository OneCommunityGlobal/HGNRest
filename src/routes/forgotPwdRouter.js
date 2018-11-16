const express = require('express');

const router = function (userProfile) {
  const forgotPwdRouter = express.Router();
  const controller = require('../controllers/forgotPwdcontroller')(userProfile);
  forgotPwdRouter.route('/forgotpassword')
    .post(controller.forgotPwd);

  return forgotPwdRouter;
};

module.exports = router;
