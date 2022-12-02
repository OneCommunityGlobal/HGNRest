const mongoose = require('mongoose');

const forcePwdController = function (userProfile) {
  const forcePwd = function forcePwd(req, res) {
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).send({ error: 'Bad Request' });
      return;
    }

    userProfile.findById(userId, 'password')
      .then((user) => {
        user.set({ password: req.body.newPassword });
        user.save()
          .then(() => {
            res.status(200).send({ message: ' password Reset' });
          })
          .catch((error) => {
            res.status(500).send(error);
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

module.exports = forcePwdController;
