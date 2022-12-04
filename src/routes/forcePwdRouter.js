const express = require('express');


const routes = function (userProfile) {
  const forcePwdRouter = express.Router();
  const controller = require('../controllers/forcePwdController')(userProfile);

  forcePwdRouter.route('/forcepassword')
    .patch(controller.forcePwd);

  return forcePwdRouter;
};

module.exports = routes;
