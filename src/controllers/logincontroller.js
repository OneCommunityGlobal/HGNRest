const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment-timezone');
const crypto = require('crypto');
const userProfile = require('../models/userProfile');


/**
 * Returns a randomly generated, base64 encoded crytographically secure token
 * @param {*} numBytes The number of bytes stored in this token
 */
const generateSecureToken = async (numBytes) => {
  const buffer = crypto.randomBytes(numBytes);
  return buffer.toString('base64');
};


/**
 * Modifies a userProfile object by adding a new refresh token to it and then saving it
 * @param {userProfile} user
 * @returns The newly generated token object
 */
const issueRefreshToken = async (user) => {
  const tokenString = await generateSecureToken(256);

  const newToken = {
    token: tokenString,
    expirationDate: moment().add(process.env.TOKEN_LIFETIME, process.env.TOKEN_LIFETIME_UNITS).toDate(),
  };

  await user.refreshTokens.push(newToken);

  await user.save();

  return newToken;
};


const getSignedJwt = (user) => {
  const jwtPayload = {
    userid: user._id,
    role: user.role,
  };

  const signatureOptions = {
    expiresIn: '60 seconds',
  };

  const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, signatureOptions);

  return token;
};


const logincontroller = () => {
  const login = async (req, res) => {
    const DEFAULT_PASSWORD = '123Welcome!';

    if (!req.body.email || !req.body.password) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }

    const user = await userProfile
      .findOne({
        email: {
          $regex: req.body.email,
          $options: 'i',
        },
      })
      .catch((error) => {
        res.status(400).send(error);
      });

    // returning 403 if the user not found or the found user is inactive.
    if (!user || user.isActive === false) {
      res.status(403).send({ message: 'Invalid email and/ or password.' });
      return;
    }

    let isNewUser = (req.body.password === DEFAULT_PASSWORD);

    let isPasswordMatch = await bcrypt.compare(req.body.password, user.password);

    if (!isPasswordMatch && user.resetPwd !== '') {
      isPasswordMatch = (req.body.password === user.resetPwd);
      isNewUser = true;
    }

    if (isNewUser && isPasswordMatch) {
      const result = {
        new: true,
        userId: user._id,
      };
      res.send(result).status(200);
    } else if (isPasswordMatch && !isNewUser) {
      let refreshToken;

      try {
        refreshToken = await issueRefreshToken(user);
      } catch (err) {
        res.status(401).send('Unable to generate refresh token.');
        return;
      }

      const token = getSignedJwt(user);

      res.send({ token, refreshToken }).status(200);
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
    login, getUser, issueRefreshToken, generateSecureToken, getSignedJwt,
  };
};

module.exports = logincontroller;
