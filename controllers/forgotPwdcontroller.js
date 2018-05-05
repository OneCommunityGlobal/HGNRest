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
                user.set({ password: "Vol123456" });
                user.save()
                .then(results => {
                  res.status(200).send({ "message": "updated password" });
                  return;
                })
                .catch(error => {
                  res.status(500).send(error);
                  return;
                })
                // console.log( user.password);
                // res.send('success');
            }
  
        }
    }
    return {forgotPwd : forgotPwd};
}

module.exports = forgotPwdController;