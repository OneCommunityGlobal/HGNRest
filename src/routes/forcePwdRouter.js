const express = require('express');

const routes = function (userProfile) {
  const forcePwdrouter = express.Router();
  const controller = require('../controllers/forcePwdController')(userProfile);

  forcePwdrouter.route('/forcepassword')
    .patch(controller.forcePwd);

  return forcePwdrouter;
};

module.exports = routes;
