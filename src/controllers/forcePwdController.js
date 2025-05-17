const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const forcePwdcontroller = function (userProfile) {
  const forcePwd = function forcePwd(req, res) {
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).send({ error: 'Bad Request' });
      return;
    }
    userProfile
      .findById(userId, 'password')
      .then(async (user) => {
        await bcrypt.compare(req.body.newpassword, user.password).then((passwordMatch) => {
          if (passwordMatch) {
            res.status(400).send({
              error: 'Please do not use default password',
            });
          } else {
            user.set({ password: req.body.newpassword });
            user
              .save()
              .then(() => {
                res.status(200).send({ message: ' password Reset' });
              })
              .catch((error) => {
                res.status(500).send(error);
              });
          }
        });
      })
      .catch((error) => {
        res.status(500).send(error);
      });
  };
  return {
    forcePwd,
  };
};

module.exports = forcePwdcontroller;
