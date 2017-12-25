let express = require('express');
let userprofile = require('../models/userProfile');
let bcrypt = require('bcryptjs');
let jwt = require('jsonwebtoken');

let logincontroller = function () {

  const JWT_HEADER = {
    "alg": "RS256",
    "typ": "JWT"
  };

  const JWT_SECRET = "hgndata";

  let login = async function _login(req, res) {

   
    let _userName = req.body.userName;
    let _password = req.body.password;

    _userName = _userName.toLowerCase();


    let user = await userprofile.findOne({$or: [{userName: _userName}, {email: _userName}]     
    });

    

    if (!user) {
      res.send({
        message: "Invalid username and/ or password."
      }).status(401);

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
      res.send({
        message: "Invalid username and/ or password."
      }).status(401);
    }

  }

  return {

    login: login
  };

};

module.exports = logincontroller;
