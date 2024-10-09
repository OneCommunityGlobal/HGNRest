const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const config = require('../../config');
const userprofile = require('../../models/userProfile');

const biddingLoginController = function () {
  const { JWT_SECRET } = config;
  const biddingLogin = async function _login(req, res) {
    const { email: _email, password: _password } = req.body;
    const currentToken = req.headers.authorization;
    try {
      const decode = jwt.verify(currentToken, JWT_SECRET);
      const user = await userprofile.findOne({ _id: decode.userid });

      // check email
      if (user.email !== _email) {
        res.status(422);
        return res.json({
          label: 'email',
          message: 'Email must match current login. Please try again.',
        });
      }
      // check password
      const check = await bcrypt.compare(_password, user.password);
      if (!check) {
        res.status(422);
        return res.json({
          label: 'password',
          message: 'Password must match current login. Please try again.',
        });
      }
      // create new token
      const jwtPayload = {
        ...decode,
        access: {
          canAccessBiddingPortal: true,
        },
      };
      const newToken = jwt.sign(jwtPayload, JWT_SECRET);
      return res.json({ token: newToken });
    } catch (err) {
      res.json(err);
    }
  };
  return { biddingLogin };
};

module.exports = biddingLoginController;
