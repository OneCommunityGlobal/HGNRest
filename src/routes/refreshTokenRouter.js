const express = require('express');
const userProfile = require('models/userProfile');
const { issueRefreshToken, getSignedJwt } = require('controllers/logincontroller')();
const moment = require('moment-timezone');

/**
 * Client provides a refresh token to the server. In return,
 * the server issues a new access and refresh token to the client.
 * The origianl refresh token is invalidated during this process.
 * @param {*} req
 * @param {*} res
 * @param {string} req.body.refreshToken base64 encoded token string
 */
const postRefreshToken = async (req, res) => {
  if (!req.body.refreshToken) {
    res.status(401).send('Refresh token not provided.');
    return;
  }

  try {
    const user = await userProfile.findOne({ 'refreshTokens.token': req.body.refreshToken });

    if (!user) {
      res.status(400).send('Invalid refresh token.');
      return;
    }

    const newRefreshToken = await issueRefreshToken(user);

    // Removes the refesh token being provided by the client and elimiates any possibly outdated tokens.
    const updatedRefreshTokens = user.refreshTokens.filter(tokenEntry => (
      tokenEntry.token !== req.body.refreshToken
        && (moment().diff(moment(tokenEntry.expirationDate), 'seconds') <= 0)
    ));

    user.refreshTokens = updatedRefreshTokens;

    await user.save();

    res.status(200).send({
      refreshToken: newRefreshToken,
      token: getSignedJwt(user),
    });
  } catch (err) {
    console.log('An error occurred while attempting to consume this refresh token.');
    console.log(err);
    res.status(400).send('An error occurred while attempting to consume this refresh token.');
  }
};

module.exports = () => {
  const router = express.Router();

  router
    .route('/refreshToken')
    .post(postRefreshToken);

  return router;
};
