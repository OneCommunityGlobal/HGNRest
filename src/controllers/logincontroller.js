const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');
const userprofile = require('../models/userProfile');

const logincontroller = function () {
  const { JWT_SECRET } = config;

  const login = async function _login(req, res) {
    const _email = req.body.email;
    const _password = req.body.password;
    const _defPwd = '123Welcome!';
    if (!_email || !_password) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }


    const user = await userprofile.findOne({ email: { $regex: _email, $options: 'i' } })
      .catch(error => res.status(400).send(error));

    // returning 403 if the user not found or the found user is inactive.
    if (!user || user.isActive === false) {
      res.status(403).send({ message: 'Invalid email and/ or password.' });
      return;
    }

    let isPasswordMatch = false;
    let isNewUser = false;
    if (_password === _defPwd) {
      isNewUser = true;
    }

    isPasswordMatch = await bcrypt.compare(_password, user.password);

    if (isNewUser && isPasswordMatch) {
      const result = {
        new: true,
        userId: user._id,
      };
      res.send(result).status(200);
    } else if (isPasswordMatch && !isNewUser) {
      const jwtPayload = {
        userid: user._id,
        role: user.role,
        expiryTimestamp: moment().add(config.TOKEN.Lifetime, config.TOKEN.Units),
      };


      const token = jwt.sign(jwtPayload, JWT_SECRET);

      res.send({ token }).status(200);
    } else {
      res.status(403).send({
        message: 'Invalid email and/ or password.',
      });
    }
  };

  const getUser = function (req, res) {
    const { requestor } = req.body;

    res.status(200).send(requestor);
  };

  return {

    login,
    getUser,
  };
};

module.exports = logincontroller;
