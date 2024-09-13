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
    const _defPwd = process.env.DEF_PWD;
    if (!_email || !_password) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }

    try {
      const user = await userprofile.findOne({ email: _email });

      // returning 403 if the user not found or the found user is inactive.
      if (!user) {
        res.status(403).send({ message: 'Username not found.' });
      } else if (user.isActive === false) {
        res.status(403).send({
          message:
            'Sorry, this account is no longer active. If you feel this is in error, please contact your Manager and/or Administrator.',
        });
      } else {
        let isPasswordMatch = false;
        let isNewUser = false;
        if (_password === _defPwd) {
          isNewUser = true;
        }

        isPasswordMatch = await bcrypt.compare(_password, user.password);

        if (!isPasswordMatch && user.resetPwd !== '') {
          isPasswordMatch = _password === user.resetPwd;
          isNewUser = true;
        }

        if (isNewUser && isPasswordMatch) {
          const result = {
            new: true,
            userId: user._id,
          };
          res.status(200).send(result);
        } else if (isPasswordMatch && !isNewUser) {
          const jwtPayload = {
            userid: user._id,
            role: user.role,
            permissions: user.permissions,
            access: {
              canAccessBMPortal: false,
              canAccessBiddingPortal: false,
            },
            email: user.email,
            expiryTimestamp: moment().add(config.TOKEN.Lifetime, config.TOKEN.Units),
          };

          const token = jwt.sign(jwtPayload, JWT_SECRET);

          res.status(200).send({ token });
        } else {
          res.status(404).send({
            message: 'Invalid password.',
          });
        }
      }
    } catch (err) {
      console.log(err);
      res.json(err);
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
