/* eslint-disable */
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const currentWarnings = require('../models/currentWarnings');
const emailSender = require('../utilities/emailSender');
const userHelper = require('../helpers/userHelper')();
const helper = require('../utilities/permissions');
let currentWarningDescriptions = null;
let currentUserName = null;
const emailTemplate = {
  thirdWarning: {
    subject: 'Third Warning',
    body: `<p>This is the 3rd time the Admin team has requested the same thing from you. Specifically <“tracked area”>. Please carefully review the communications you’ve gotten about this so you understand what is being requested. Ask questions if anything isn’t clear, the Admin team is here to help.</p>
    <p>Please also be sure to fix this from here on forward, asking for the same thing over and over requires administration that really shouldn’t be needed and will result in a blue square if it happens again.</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`,
  },
  fourthWarning: {
    subject: 'Fourth Warning',
    body: `<p> username ! </p>
    <p>This is the 3rd time the Admin team has requested the same thing from you. Specifically <“tracked area”>. Please carefully review the communications you’ve gotten about this so you understand what is being requested. Ask questions if anything isn’t clear, the Admin team is here to help.</p>
    <p>Please also be sure to fix this from here on forward, asking for the same thing over and over requires administration that really shouldn’t be needed and will result in a blue square if it happens again.</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`,
  },
};
async function getWarningDescriptions() {
  currentWarningDescriptions = await currentWarnings.find({}, { warningTitle: 1, _id: 0 });
}

const warningsController = function (UserProfile) {
  const getWarningsByUserId = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'viewTrackingOverview'))) {
      res.status(403).send('You are not authorized to view Tracking Overview.');
      return;
    }
    currentWarningDescriptions = await currentWarnings.find({
      activeWarning: true,
    });

    currentWarningDescriptions = currentWarningDescriptions.map((a) => a.warningTitle);
    const { userId } = req.params;

    try {
      const { warnings } = await UserProfile.findById(userId);

      const { completedData } = filterWarnings(currentWarningDescriptions, warnings);

      if (!warnings) {
        return res.status(400).send({ message: 'no valiud records' });
      }
      res.status(201).send({ warnings: completedData });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  const postWarningsToUserProfile = async function (req, res) {
    if (
      !(await helper.hasPermission(req.body.requestor, 'issueTrackingWarnings')) &&
      !(await helper.hasPermission(req.body.requestor, 'issueBlueSquare'))
    ) {
      res.status(403).send('You are not authorized to issueBlueSquare or a Warning.');
      return;
    }
    try {
      const { userId } = req.params;

      const { iconId, color, date, description } = req.body;
      const { monitorData } = req.body;

      const record = await UserProfile.findById(userId);
      if (!record) {
        return res.status(400).send({ message: 'No valid records found' });
      }

      const userAssignedWarning = {
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
      };

      const updatedWarnings = await UserProfile.findByIdAndUpdate(
        {
          _id: userId,
        },
        { $push: { warnings: { userId, iconId, color, date, description } } },
        { new: true, upsert: true },
      );

      const { completedData, sendEmail, size } = filterWarnings(
        currentWarningDescriptions,
        updatedWarnings.warnings,
        iconId,
        color,
      );

      const adminEmails = await getUserRoleByEmail(record);
      if (sendEmail !== null) {
        sendEmailToUser(
          sendEmail,
          description,
          userAssignedWarning,
          monitorData,
          size,
          adminEmails,
        );
      }

      res.status(201).send({ message: 'success', warnings: completedData });
    } catch (error) {
      res.status(400).send({ message: error.message || error });
    }
  };

  const deleteUsersWarnings = async (req, res) => {
    if (!(await helper.hasPermission(req.body.requestor, 'deleteWarning'))) {
      res.status(403).send('You are not authorized to delete a Warning.');
      return;
    }
    const { userId } = req.params;
    const { warningId } = req.body;

    try {
      const warnings = await UserProfile.findOneAndUpdate(
        { _id: userId },
        { $pull: { warnings: { _id: warningId } } },
        { new: true, upsert: true },
      );

      if (!warnings) {
        return res.status(400).send({ message: 'no valid records' });
      }

      const { completedData } = filterWarnings(currentWarningDescriptions, warnings.warnings);
      res.status(201).send({ message: 'succesfully deleted', warnings: completedData });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  return {
    getWarningsByUserId,
    postWarningsToUserProfile,
    deleteUsersWarnings,
  };
};

//helper to get the team members admin emails
async function getUserRoleByEmail(user) {
  //replacement for jae's email
  const recipients = ['test@test.com'];
  for (const teamId of user.teams) {
    const managementEmails = await userHelper.getTeamManagementEmail(teamId);
    if (Array.isArray(managementEmails) && managementEmails.length > 0) {
      managementEmails.forEach((management) => {
        recipients.push(management.email);
      });
    }
  }

  return [...new Set(recipients)];
}

//helper function to get the ordinal
function getOrdinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = n % 100;
  return n + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
}
const sendEmailToUser = (
  sendEmail,
  warningDescription,
  userAssignedWarning,
  monitorData,
  size,
  adminEmails,
) => {
  const ordinal = getOrdinal(size);
  const subjectTitle = ordinal + ' Warning';

  const currentUserName = `${userAssignedWarning.firstName} ${userAssignedWarning.lastName}`;
  const emailTemplate =
    sendEmail === 'issue warning'
      ? `<p>Hello ${currentUserName},</p>
         <p>This is the <strong>${ordinal}</strong> time the Admin team has requested the same thing from you. Specifically, <strong>${warningDescription}</strong>. Please carefully review the previous communications you’ve received to fully understand what is being requested. If anything is unclear, don’t hesitate to ask questions—the Admin team is here to assist.</p>
         <p>Moving forward, please ensure this issue is resolved. Repeated requests for the same thing require unnecessary administrative attention and may result in a blue square being issued if it happens again.</p>
         <p>The Admin member who issued the warning is ${monitorData.firstName} ${monitorData.lastName} and their email is ${monitorData.email}. Please comment on your Google Doc and tag them using this email if you have any questions.</p>
         <p>With Gratitude,</p>
         <p>One Community</p>`
      : `<p>Hello ${currentUserName},</p>
         <p>A blue square has been issued because this is the ${ordinal} time the Admin team has requested the same thing from you. Specifically, <strong>${warningDescription}</strong>.</p>
         <p>Moving forward, please ensure this is resolved. Repeated requests for the same thing require unnecessary administrative attention, will result in an additional blue square being issued, and could lead to termination.</p>
         <p>Please carefully review the previous communications you’ve received to fully understand what is being requested. If anything is unclear, feel free to ask questions—the Admin team is here to help.</p>
         <p>The Admin member who issued this blue square is ${monitorData.firstName} ${monitorData.lastName} and can be reached at ${monitorData.email}. If you have any questions, please comment on your Google Doc and tag them using this email.</p>
         <p>With Gratitude,</p>
         <p>One Community</p>`;

  if (sendEmail === 'issue warning') {
    emailSender(
      `${userAssignedWarning.email}`,
      subjectTitle,
      emailTemplate,
      null,
      adminEmails.toString(),
      null,
    );
  } else if (sendEmail === 'issue blue square') {
    emailSender(
      `${userAssignedWarning.email}`,
      `Blue Square issued for ${warningDescription}`,
      null,
      emailTemplate,
      adminEmails.toString(),
      null,
    );
  }
};

// gets the dsecriptions key from the array
const getDescriptionKey = (val) => currentWarningDescriptions.indexOf(val);

const sortKeysAlphabetically = (a, b) => getDescriptionKey(a) - getDescriptionKey(b);

// method to see which color is first
const getColorIndex = (color) => {
  const colorOrder = ['blue', 'yellow', 'red'];
  return colorOrder.indexOf(color);
};

const sortByColorAndDate = (a, b) => {
  // First, sort by color
  const colorComparison = getColorIndex(a.color) - getColorIndex(b.color);

  // If colors are the same, sort by date
  if (colorComparison === 0) {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  }

  return colorComparison;
};

const filterWarnings = (currentWarningDescriptions, warnings, iconId = null, color = null) => {
  const warningsObject = {};

  let sendEmail = null;
  let size = null;

  warnings.forEach((warning) => {
    if (!warningsObject[warning.description]) {
      warningsObject[warning.description] = [];
    }
    warningsObject[warning.description].push(warning);

    if (
      warningsObject[warning.description].length >= 3 &&
      warning.iconId === iconId &&
      color === 'yellow'
    ) {
      sendEmail = 'issue warning';
      size = warningsObject[warning.description].length;
    } else if (warning.iconId === iconId && color === 'red') {
      sendEmail = 'issue blue square';
      size = warningsObject[warning.description].length;
    }
  });

  const warns = Object.keys(warningsObject)
    .sort(sortKeysAlphabetically)
    .reduce((acc, cur) => {
      acc[cur] = warningsObject[cur];
      return acc;
    }, {});

  for (const keys of Object.keys(warns)) {
    warns[keys] = warns[keys].sort(sortByColorAndDate);
  }

  const completedData = [];

  for (const descrip of currentWarningDescriptions) {
    completedData.push({
      title: descrip,
      warnings: warns[descrip] ? warns[descrip] : [],
    });
  }
  return { completedData, sendEmail, size };
};

module.exports = warningsController;
