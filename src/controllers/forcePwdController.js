const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const forcePwdcontroller = function (userProfile) {
  const forcePwd = async function forcePwd(req, res) {
    const { userId, newpassword } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send({ error: 'Bad Request' });
    }

    try {
      const user = await userProfile.findById(userId, 'password');
      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }

      const passwordMatch = await bcrypt.compare(newpassword, user.password);
      if (passwordMatch) {
        return res.status(400).send({ error: 'Please do not use default password' });
      }

      user.set({ password: newpassword });

      try {
        await user.save();
        return res.status(200).send({ message: 'password Reset' });
      } catch (saveError) {
        return res.status(500).send({ error: 'Error happened when saving user' });
      }
    } catch (error) {
      return res.status(500).send({ error: 'Error happened when finding user' });
    }
  };

  return {
    forcePwd,
  };
};

module.exports = forcePwdcontroller;