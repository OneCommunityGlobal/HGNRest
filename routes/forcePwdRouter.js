var express = require('express');


var routes = function(userProfile){
var forcePwdrouter = express.Router();
var controller = require('../controllers/forcePwdController')(userProfile);

forcePwdrouter.route('/forcepassword')
.patch(controller.forcePwd);

return forcePwdrouter;

};

module.exports = routes;