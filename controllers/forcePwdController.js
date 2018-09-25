let express = require('express');
var mongoose = require('mongoose');

let forcePwdcontroller = function (userProfile) {
  
    let forcePwd =  function forcePwd(req, res) {
        let userId = req.body.userId;
     
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          res.status(400).send({ "error": "Bad Request" });
          return;
        }

        userProfile.findById(userId, 'password')
        .then(user => {
          user.set({ password: req.body.newpassword });
          user.save()
            .then(results => {
              res.status(200).send({ "message": " password Reset" });
              return;
            })
            .catch(error => {
              res.status(500).send(error);
              return;
            })
        }
        )
        .catch(error => {
          res.status(500).send(error);
          return;
        })
  
    }
  return {
    forcePwd:forcePwd
  };

};

module.exports = forcePwdcontroller;
