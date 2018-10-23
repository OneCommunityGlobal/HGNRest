let express = require('express');
let userprofile = require('../models/userProfile');
let bcrypt = require('bcryptjs');
let jwt = require('jsonwebtoken');
let config = require('../config');
let moment = require('moment');

let logincontroller = function () {

  const JWT_HEADER = config.JWT_HEADER;

  const JWT_SECRET = process.env.JWT_SECRET;

  let login = async function _login(req, res, next) {

    let _email = req.body.email;
    let _password = req.body.password;
    let _defPwd="123Welcome!";
    if (!_email || !_password) {
      res.status(400).send({ "error": "Invalid request" });
      return;
    }

    _email = _email.toLowerCase();


    let user = await userprofile.findOne({ email: _email })
      .catch(error => res.status(400).send(error));



    if (!user) {
      res.status(403).send("Invalid email and/ or password.");
      return;
    }
    
    let isPasswordMatch = false;
    let isNewUser =false;
    if(_password === _defPwd){
      isNewUser=true;
    }
   
    isPasswordMatch = await bcrypt.compare(_password, user.password);
    
    if (isNewUser && isPasswordMatch){
      let result =
        {
          "new": true,
          "userId":user._id
        }
      res.send(result).status(200);
    }
    else if (isPasswordMatch && !isNewUser) {

      let jwt_payload = {
        "userid": user._id,
        "role": user.role,
        "expiryTimestamp": moment().add(config.TOKEN.Lifetime, config.TOKEN.Units)
      };


      let token = jwt.sign(jwt_payload, JWT_SECRET);

      let result =
        {
          "token": token,

        }


      res.send(result).status(200);
    } else {
      res.status(403).send({
        message: ""
      });
      
    }

  }

  let getUser = function (req, res) {

    let requestor = req.body.requestor;

    res.status(200).send(requestor);

  };

  return {

    login: login,
    getUser: getUser
  };

};

module.exports = logincontroller;
