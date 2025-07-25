const uuidv4 = require('uuid/v4');
const emailSender = require('../utilities/emailSender');
const logger = require('../startup/logger');
const escapeRegex = require('../utilities/escapeRegex');


function getEmailMessageForForgotPassword(user, ranPwd) {
  const message = `<b> Hello ${user.firstName} ${user.lastName},</b>
    <p>Congratulations on successfully completing the Highest Good Network 3-question Change My Password Challenge. Your reward is this NEW PASSWORD! </p>
    <blockquote> ${ranPwd}</blockquote>
    <p>Use it now to log in. Then store it in a safe place or change it on your Profile Page to something easier for you to remember. </p>
    <p>If it wasn’t you that requested this password change, you can ignore this email. Otherwise, use the password above to log in and you’ll be directed to the “Change Password” page where you can set a new custom one. </p>
    <p>Thank you,<p>
    <p>One Community</p>`;
  return message;
}

const forgotPwdController = function (userProfile) {
  const forgotPwd = async function (req, res) {
    try {
      const _email = req.body.email.toLowerCase();
      const _firstName = req.body.firstName;
      const _lastName = req.body.lastName;

      const user = await userProfile.findOne({
        email: { $regex: escapeRegex(_email), $options: 'i' },
        firstName: { $regex: escapeRegex(_firstName), $options: 'i' },
        lastName: { $regex: escapeRegex(_lastName), $options: 'i' },
      });

      if (!user) {
        return res.status(400).send({ error: 'No Valid user was found' });
      }

      const ranPwd = uuidv4().concat('TEMP');
      user.set({ resetPwd: ranPwd });

      try {
        await user.save();

        await emailSender(
          user.email,
          'Account Password change',
          getEmailMessageForForgotPassword(user, ranPwd),
          null,
          null,
        );

        logger.logInfo(`New password ${ranPwd} was generated for ${user._id}`);
        return res.status(200).send({ message: 'generated new password' });
      } catch (error) {
        logger.logException(error);
        return res.status(500).send(error);
      }
    } catch (error) {
      logger.logException(error);
      return res.status(500).send(error);
    }
  };
  const sendBugReport = async (req, res) => {
    try {
      await emailSender(
        'suggestion@onecommunityglobal.org',
        'Bug Reported',
        JSON.stringify(req.body, null, 2),
      );
      res.status(200).send('Success');
    } catch (error) {
      logger.logException(error);
      res.status(500).send('Failed to send email');
    }
  };

  const sendMakeSuggestion = async (req, res) => {
    try {
      await emailSender(
        'suggestion@onecommunityglobal.org',
        'New Suggestion',
        JSON.stringify(req.body, null, 2),
      );
      res.status(200).send('Success');
    } catch (error) {
      logger.logException(error);
      res.status(500).send('Failed to send email');
    }
  };

  const getSuggestionOption = async (_req, res) => {
    try {
      const suggestionData = {
        field: [],
        suggestion: [
          'Identify and remedy poor client and/or user service experiences',
          'Identify bright spots and enhance positive service experiences',
          'Make fundamental changes to our programs and/or operations',
          'Inform the development of new programs/projects',
          'Identify where we are less inclusive or equitable across demographic groups',
          'Strengthen relationships with the people we serve',
          "Understand people's needs and how we can help them achieve their goals",
          'Other',
        ],
      };
      res.status(200).send(suggestionData);
    } catch (error) {
      logger.logException(error);
      res.status(404).send('Suggestion Data Not Found');
    }
  };

  const editSuggestionOption = async (req, res) => {
    try {
      const { action, newField, suggestion } = req.body;
      const suggestionData = {
        suggestion: ['newSuggestion'],
        field: ['newField'],
      };

      if (action === 'add') {
        if (suggestion) {
          suggestionData.suggestion.push(newField);
        } else {
          suggestionData.field.push(newField);
        }
      } else if (action === 'delete') {
        if (suggestion) {
          suggestionData.suggestion = suggestionData.suggestion.filter(s => s !== newField);
        } else {
          suggestionData.field = suggestionData.field.filter(f => f !== newField);
        }
      }

      res.status(200).send('success');
    } catch (error) {
      logger.logException(error);
      res.status(500).send('Error updating suggestion data');
    }
  };

  return { forgotPwd, sendBugReport, sendMakeSuggestion, getSuggestionOption, editSuggestionOption };
};

module.exports = forgotPwdController;
// module.exports = (UserProfile) => ({
//   forgotPwd,
//   sendBugReport,
//   sendMakeSuggestion,
//   getSuggestionOption,
//   editSuggestionOption,
// });