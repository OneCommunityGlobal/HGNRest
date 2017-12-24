var express = require('express');


var routes = function(){
var loginrouter = express.Router();
var controller = require('../controllers/logincontroller')();

loginrouter.route('/login')
.post(controller.login );

return loginrouter;

};

module.exports = routes;