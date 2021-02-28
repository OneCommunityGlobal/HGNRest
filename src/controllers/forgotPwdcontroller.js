const uuidv4 = require('uuid/v4');
const emailSender = require('../utilities/emailSender');
const logger = require('../startup/logger');


function getEmailMessageForForgotPassword(user, ranPwd) {
  const message = `<b> Hello ${user.firstName} ${user.lastName},</b>
    <p>Do not reply to this mail.</p> 
    <p>Your 'forgot password' request was recieved and here is your new password:</p>
    <blockquote> ${ranPwd}</blockquote>
    <p>Please change this password the next time you log in. Do this by clicking the arrow in the top-right corner by your profile picture and then selecting the "Update Password" option. </P>
    <p>Thank you,<p>
    <p>One Community</p>
    `;
  return message;
}

const forgotPwdController = function (userProfile) {
  const forgotPwd = async function (req, res) {
    const _email = (req.body.email).toLowerCase();
    const _firstName = (req.body.firstName);
    const _lastName = (req.body.lastName);

    const user = await userProfile.findOne({
      email: { $regex: _email, $options: 'i' },
      firstName: { $regex: _firstName, $options: 'i' },
      lastName: { $regex: _lastName, $options: 'i' },
    })
      .catch((error) => {
        res.status(500).send(error);
        logger.logException(error);
      });

    if (!user) {
      res.status(400).send({ error: 'No Valid user was found' });
      return;
    }
    const ranPwd = uuidv4().concat('TEMP');
    user.set({ resetPwd: ranPwd });
    user.save()
      .then(() => {
        emailSender(
          user.email,
          'Account Password change',
          getEmailMessageForForgotPassword(user, ranPwd),
          null,
          null,
        );
        logger.logInfo(`New password ${ranPwd} was generated for user._id`);

        res.status(200).send({ message: 'generated new password' });
      })
      .catch((error) => {
        logger.logException(error);
        res.status(500).send(error);
      });
  };
  return { forgotPwd };
};

module.exports = forgotPwdController;
