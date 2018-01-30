let express = require('express');
let userprofile = require('../models/userProfile');
let bcrypt = require('bcryptjs');
let jwt = require('jsonwebtoken');
let config = require('../config');
let moment = require('moment');

let logincontroller = function () {

  const JWT_HEADER = {
    "alg": "RS256",
    "typ": "JWT"
  };

  const JWT_SECRET = config.JWT_SECRET;

  let login = async function _login(req, res) {
   
    let _email = req.body.email;
    let _password = req.body.password;

    if(!_email || !_password)
    {
      res.status(400).send("Invalid request");
      return;
    }
    
    _email = _email.toLowerCase();


    let user = await userprofile.findOne({email: _email})
    .catch(error => res.status(400).send(error));

    

    if (!user) {
      res.status(403).send("Invalid email and/ or password.");
      return;  
    }

    let isPasswordMatch = false;
    isPasswordMatch = await bcrypt.compare(_password, user.password);

    if (isPasswordMatch) {

      let jwt_payload = {
        "userid": user._id,
        "role": user.role,
        "expiryTimestamp": moment().add(config.TOKEN.Lifetime, config.TOKEN.Units)
      };
    

      let token = jwt.sign(jwt_payload, JWT_SECRET);
      

      res.send(token).status(200);
    } else {
      res.status(403).send({
        message: "Invalid email and/ or password."
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
