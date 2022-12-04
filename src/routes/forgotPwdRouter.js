const express = require('express');

const router = function (userProfile) {
  const forgotPwdRouter = express.Router();
  const controller = require('../controllers/forgotPwdController')(userProfile);
  forgotPwdRouter.route('/forgotPassword')
    .post(controller.forgotPwd);

  return forgotPwdRouter;
};

module.exports = router;
