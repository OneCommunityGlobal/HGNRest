let express = require('express');
let userprofile = require('../models/userProfile');
let bcrypt = require('bcryptjs');
let jwt = require('jsonwebtoken');
let config = require('../config');

let logincontroller = function () {

  const JWT_HEADER = {
    "alg": "RS256",
    "typ": "JWT"
  };

  const JWT_SECRET = config.JWT_SECRET;

  let login = async function _login(req, res) {
   
    let _userName = req.body.userName;
    let _password = req.body.password;

    if(!_userName || !_password)
    {
      res.status(400).send("Invalid request");
      return;
    }
    
    _userName = _userName.toLowerCase();


    let user = await userprofile.findOne({$or: [{userName: _userName}, {email: _userName}]     
    })
    .catch(error => res.status(400).send(error));

    

    if (!user) {
      res.status(403).send("Invalid username and/ or password.");
      return;
  
    }

    let isPasswordMatch = false;
    isPasswordMatch = await bcrypt.compare(_password, user.password);

    if (isPasswordMatch) {

      let jwt_payload = {
        "userid": user._id,
        "role": user.role,
        "loggedinDate": Date.now()
      };

      let token = jwt.sign(jwt_payload, JWT_SECRET);
      

      res.send(token).status(200);
    } else {
      res.status(403).send({
        message: "Invalid username and/ or password."
      });
    }

  }

  let getUser = function(req, res)
  {
   
    let requestor = req.body.requestor;

    res.status(200).send(requestor);

  };

  return {

    login: login,
    getUser : getUser
  };

};

module.exports = logincontroller;
