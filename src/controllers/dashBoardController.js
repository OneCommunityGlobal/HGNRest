/* eslint-disable quotes */
const mongoose = require('mongoose');
const dashboardHelperClosure = require('../helpers/dashboardhelper');
const emailSender = require('../utilities/emailSender');
const AIPrompt = require('../models/weeklySummaryAIPrompt');
const User = require('../models/userProfile');

const dashboardcontroller = function () {
  const dashboardhelper = dashboardHelperClosure();
  const dashboarddata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);

    const snapshot = dashboardhelper.personaldetails(userId);

    snapshot.then((results) => {
      res.status(200).send(results);
    });
  };
  // The Code below updates the time the AiPrompt was copied by the user - Sucheta
  // eslint-disable-next-line space-before-blocks
  const updateCopiedPrompt = function (req, res) {
    return User.findOneAndUpdate(
      { _id: req.params.userId },
      { copiedAiPrompt: Date.now() },
      { new: true },
    )
      .then((user) => {
        if (user) {
          res.status(200).send('Copied AI prompt');
        } else {
          res.status(404).send({ message: 'User not found ' });
        }
      })
      .catch((error) => {
        res.status(500).send(error);
      });
  };
  const getPromptCopiedDate = function (req, res) {
    return User.findOne({ _id: req.params.userId }).then((user) => {
      if (user) {
        res.status(200).send({ message: user.copiedAiPrompt });
      }
    });
  };
  const updateAIPrompt = function (req, res) {
    if (req.body.requestor.role === 'Owner') {
      AIPrompt.findOneAndUpdate(
        { _id: 'ai-prompt' },
        {
          ...req.body,
          aIPromptText: req.body.aIPromptText,
          modifiedDatetime: Date.now(),
        },
      )
        .then(() => {
          res.status(200).send('Successfully saved AI prompt.');
        })
        .catch((error) => res.status(500).send(error));
    }
  };

  const getAIPrompt = function (req, res) {
    AIPrompt.findById({ _id: 'ai-prompt' })
      .then((result) => {
        if (result) {
          // If the GPT prompt exists, send it back.
          res.status(200).send(result);
        } else {
          // If the GPT prompt does not exist, create it.
          const defaultPrompt = {
            _id: 'ai-prompt',
            aIPromptText:
              "Please edit the following summary of my week's work. Make sure it is professionally written in 3rd person format.\nWrite it as only one paragraph. It must be only one paragraph. Keep it less than 500 words. Start the paragraph with 'This week'.\nMake sure the paragraph contains no links or URLs and write it in a tone that is matter-of-fact and without embellishment.\nDo not add flowery language, keep it simple and factual. Do not add a final summary sentence. Apply all this to the following:",
          };
          AIPrompt.create(defaultPrompt)
            .then((newResult) => {
              res.status(200).send(newResult);
            })
            .catch((creationError) => {
              res.status(500).send(creationError);
            });
        }
      })
      .catch((error) => res.status(500).send(error));
  };

  const monthlydata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const laborthismonth = dashboardhelper.laborthismonth(
      userId,
      req.params.fromDate,
      req.params.toDate,
    );
    laborthismonth.then((results) => {
      if (!results || results.length === 0) {
        const emptyresult = [
          {
            projectName: '',
            timeSpent_hrs: 0,
          },
        ];
        res.status(200).send(emptyresult);
        return;
      }
      res.status(200).send(results);
    });
  };

  const weeklydata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const laborthisweek = dashboardhelper.laborthisweek(
      userId,
      req.params.fromDate,
      req.params.toDate,
    );
    laborthisweek.then((results) => {
      res.status(200).send(results);
    });
  };

  const leaderboarddata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const leaderboard = dashboardhelper.getLeaderboard(userId);
    leaderboard
      .then((results) => {
        if (results.length > 0) {
          res.status(200).send(results);
        } else {
          const { getUserLaborData } = dashboardhelper;
          getUserLaborData(userId).then((r) => {
            res.status(200).send(r);
          });
        }
      })
      .catch((error) => res.status(400).send(error));
  };

  // 6th month and yearly anniversaries
  const postTrophyIcon = function (req, res) {
    console.log('API called with params:', req.params);
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const trophyFollowedUp = req.params.trophyFollowedUp === 'true';

    User.findByIdAndUpdate(userId, { trophyFollowedUp }, { new: true })
      .then((updatedRecord) => {
        if (!updatedRecord) {
          return res.status(404).send('No valid records found');
        }
        res.status(200).send(updatedRecord);
      })
      .catch((error) => {
        console.error('Error updating trophy icon:', error);
        res.status(500).send(error);
      });
  };

  const orgData = function (req, res) {
    const fullOrgData = dashboardhelper.getOrgData();

    fullOrgData
      .then((results) => {
        res.status(200).send(results[0]);
      })
      .catch((error) => res.status(400).send(error));
  };

  const getBugReportEmailBody = function (
    firstName,
    lastName,
    title,
    environment,
    reproduction,
    expected,
    actual,
    visual,
    severity,
  ) {
    const text = `New Bug Report From <b>${firstName} ${lastName}</b>:
        <p>[Feature Name] Bug Title:</p>
        <p>${title}</p>
        <p>Environment (OS/Device/App Version/Connection/Time etc)</p>
        <p>${environment}</p>
        <p>Steps to reproduce (Please Number, Short Sweet to the point)</p>
        <p>${reproduction}</p>
        <p>Expected Result (Short Sweet to the point)</p>
        <p>${expected}</p>
        <p>Actual Result (Short Sweet to the point)</p>
        <p>${actual}</p>
        <p>Visual Proof (screenshots, videos, text)</p>
        <p>${visual}</p>
        <p>Severity/Priority (How Bad is the Bug?)</p>
        <p>${severity}</p>
        <p>Thank you,<br />
        One Community</p>`;

    return text;
  };

  const sendBugReport = async function (req, res) {
    const {
      firstName,
      lastName,
      title,
      environment,
      reproduction,
      expected,
      actual,
      visual,
      severity,
      email,
    } = req.body;
    const emailBody = getBugReportEmailBody(
      firstName,
      lastName,
      title,
      environment,
      reproduction,
      expected,
      actual,
      visual,
      severity,
    );

    try {
      await emailSender.sendEmail(
        'onecommunityglobal@gmail.com',
        `Bug Report from ${firstName} ${lastName}`,
        emailBody,
        email,
      );
      res.status(200).send('Success');
    } catch (error) {
      res.status(500).send('Failed to send email');
    }
  };

  const suggestionData = {
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
    field: [],
  };

  const getsuggestionEmailBody = async (...args) => {
    let fieldaaray = [];
    if (suggestionData.field.length) {
      fieldaaray = suggestionData.field.map(
        (item) => `<p>${item}</p>
                   <p>${args[3][item]}</p>`,
      );
    }
    const text = `New Suggestion From <b>${args[3].firstName} ${args[3].lastName}
    </b>:
    <br>
    <br> 
    <b> &#9913; Suggestion Category:</b>
    <p>${args[0]}</p>
    <b> &#9913; Suggestion:</b>
    <p>${args[1]}</p>
    ${fieldaaray.length > 0 ? fieldaaray : ''}
    <b> &#9913; Name of Suggester:</b>
    <p>${args[3].firstName} ${args[3].lastName}</p>
    <b> &#9913; Email of Suggester:</b>
    <p>${args[4]}</p>
    <b> &#9913; Wants Feedback:</b>
    <p>${args[2]}</p>
    <b>Thank you,<br />
    One Community</b>`;

    return text;
  };

  // send suggestion email
  const sendMakeSuggestion = async (req, res) => {
    const { suggestioncate, suggestion, confirm, email, ...rest } = req.body;
    const emailBody = await getsuggestionEmailBody(
      suggestioncate,
      suggestion,
      confirm,
      rest,
      email,
    );
    try {
      await emailSender.sendEmail(
        'onecommunityglobal@gmail.com',
        'A new suggestion',
        emailBody,
        null,
        null,
        email,
        null,
      );
      res.status(200).send('Success');
    } catch (error) {
      res.status(500).send('Failed to send email');
    }
  };

  const getSuggestionOption = async (req, res) => {
    try {
      if (suggestionData) {
        res.status(200).send(suggestionData);
      } else {
        res.status(404).send('Suggestion data not found.');
      }
    } catch (error) {
      console.error('Error getting suggestion data:', error);
      res.status(500).send('Internal Server Error');
    }
  };

  const editSuggestionOption = async (req, res) => {
    try {
      if (req.body.suggestion) {
        if (req.body.action === 'add') {
          suggestionData.suggestion.unshift(req.body.newField);
        }
        if (req.body.action === 'delete') {
          suggestionData.suggestion = suggestionData.suggestion.filter(
            (item, index) => index + 1 !== +req.body.newField,
          );
        }
      } else {
        if (req.body.action === 'add') {
          suggestionData.field.unshift(req.body.newField);
        }
        if (req.body.action === 'delete') {
          suggestionData.field = suggestionData.field.filter((item) => item !== req.body.newField);
        }
      }

      res.status(200).send('success');
    } catch (error) {
      console.error('Error editing suggestion option:', error);
      res.status(500).send('Internal Server Error');
    }
  };
  const requestFeedbackModal = async function (req, res) {
    /** request structure -  pass with userId fetched from initial load response.

    {
      "haveYouRecievedHelpLastWeek": "Yes", //no
      "peopleYouContacted":[
          {"fullName": "ABCD", "rating": 3, "isActive": false}
      ],
      "additionalComments": "Here is the text you entered",
      "daterequestedFeedback": "2025-04-20T04:04:40.189Z",
      "foundHelpSomeWhereClosePermanently": false,
      "userId": "5baac381e16814009017678c"
  } */
    try {
      const savingRequestFeedbackData = await dashboardhelper.requestFeedback(req);
      return res.status(200).json({ savingRequestFeedbackData });
    } catch (err) {
      return res.status(500).send({ msg: 'Error occured while fetching data. Please try again!' });
    }
  };

  const getUserNames = async function (req, res) {
    /** Call this api once and show in frontend.
     * this will be the response structure
     * {
    "users": [
        {
            "isActive": true,   based on this value segregate whether the user is active or inactive user.
            "firstName": "Jaeaa",
            "lastName": "Test5"
        }
    ]
  }
     */
    try {
      const usersList = await dashboardhelper.getNamesFromProfiles();
      return res.status(200).json({ users: usersList });
    } catch (err) {
      return res.status(500).send({ msg: 'Error occured while fetching data. Please try again!' });
    }
  };

  const checkUserFoundHelpSomewhere = async function (req, res) {
    /** request structure -  pass with userId fetched from initial load response.
    Only call this api, when clicking found help permanentely
    {
    "foundHelpSomeWhereClosePermanently": true,
    "userId": "5baac381e16814009017678c"
} */
    try {
      const foundHelp = await dashboardhelper.checkQuestionaireFeedback(req);
      return res.status(200).json({ foundHelp });
    } catch (err) {
      console.log(err);
      return res.status(500).send({ msg: 'Error occured while fetching data. Please try again!' });
    }
  };

  return {
    dashboarddata,
    getAIPrompt,
    updateAIPrompt,
    monthlydata,
    weeklydata,
    leaderboarddata,
    orgData,
    sendBugReport,
    getSuggestionOption,
    editSuggestionOption,
    sendMakeSuggestion,
    updateCopiedPrompt,
    getPromptCopiedDate,
    postTrophyIcon,
    requestFeedbackModal,
    getUserNames,
    checkUserFoundHelpSomewhere,
  };
};

module.exports = dashboardcontroller;
