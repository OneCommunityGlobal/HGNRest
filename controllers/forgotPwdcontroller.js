var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

var forgotPwdController = function (userProfile) {

    var forgotPwd = async function (req, res) {
        let _email = (req.body.email).toLowerCase();
        
        let user = await userProfile.findOne({ email: _email }).catch(error => res.status(400).send(error));

        if(user){
            let _firstName = (req.body.firstName);
            let _lastName =(req.body.lastName);
            
            if(user.firstName === _firstName && user.lastName === _lastName)
            {
              var ranPwd =  create_UUID().concat("TEMP");
                user.set({ password: ranPwd });
                user.save()
                .then(results => {
                 var helper = require('../helpers/forgotPwdhelper')(user,ranPwd);
                  res.status(200).send({ "message": "generated new password" });
                  return;
                })
                .catch(error => {
                  res.status(500).send(error);
                  return;
                })
            }
  
        }
    }
    return {forgotPwd : forgotPwd};
}

module.exports = forgotPwdController;

function create_UUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
};