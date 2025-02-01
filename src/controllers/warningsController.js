/* eslint-disable */
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const currentWarnings = require('../models/currentWarnings');
const emailSender = require('../utilities/emailSender');
const userHelper = require('../helpers/userHelper')();
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
  currentWarningDescriptions = await currentWarnings.find(
    { activeWarning: true },
    { warningTitle: 1, _id: 0, abbreviation: 1 },
  );
}

const convertObjectToArray = (obj) => {
  const arr = [];
  for (const key of obj) {
    arr.push(key.warningTitle);
  }
  return arr;
};

const warningsController = function (UserProfile) {
  const getWarningsByUserId = async function (req, res) {
    if (!currentWarningDescriptions) {
      await getWarningDescriptions();
    }

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

  const getSpecialWarnings = async function (req, res, next) {
    if (!currentWarningDescriptions) {
      await getWarningDescriptions();
    }

    try {
      const { userId } = req.params;
      const specialWarningsObj = await currentWarnings
        .find({
          activeWarning: true,
          isSpecial: true,
        })
        .select({ warningTitle: 1, abbreviation: 1 });
      const specialWarningsArray = convertObjectToArray(specialWarningsObj);

      const { warnings } = await UserProfile.findById(userId);

      const filteredWarnings = warnings.filter((warning) => {
        if (specialWarningsArray.includes(warning.description)) {
          return warning;
        }
      });

      const { completedData } = filterWarnings(specialWarningsObj, filteredWarnings);

      return res.status(201).send({ message: 'success', warnings: completedData });
    } catch (error) {
      console.log('error', error);
    }
  };

  const postNewWarningsByUserId = async function (req, res, next) {
    if (!currentWarningDescriptions) {
      await getWarningDescriptions();
    }
    try {
      const { userId } = req.params;
      const { warningsArray, monitorData, issueBlueSquare } = req.body;
      const record = await UserProfile.findById(userId);

      const userAssignedWarning = {
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
      };

      if (!record) {
        return res.status(400).send({ message: 'No valid records found' });
      }

      const updatedWarnings = await UserProfile.findByIdAndUpdate(
        {
          _id: userId,
        },
        {
          $push: { warnings: { $each: warningsArray } },
        },
        { new: true, upsert: true },
      );

      //the two warnings are now posted.
      //i will group them as usual using filter and set sendemail to send the email
      //issueBlueSquare flag will tell me which email I'll be sending
      //i need the size of each one as well
      //can return it via an array or object?
      // issue blue square -> size
      //issue warning ->
      const { completedData, sendEmail, size } = filterWarnings(
        currentWarningDescriptions,
        updatedWarnings.warnings,
        null,
        null,
        issueBlueSquare,
      );

      const adminEmails = await getUserRoleByEmail(record);
      if (sendEmail !== null) {
        sendEmailToUser(sendEmail, '', userAssignedWarning, monitorData, size, adminEmails);
      }

      res.status(201).send({ message: 'success', warnings: [] });
    } catch (err) {
      console.log(err);
      res.status(400).send({ message: err.message || err });
    }
  };

  const postWarningsToUserProfile = async function (req, res, next) {
    if (!currentWarningDescriptions) {
      await getWarningDescriptions();
    }
    try {
      const { userId } = req.params;
      const { warningsArray, issueBlueSquare, monitorData, iconId, color, date, description } =
        req.body;

      const record = await UserProfile.findById(userId);

      if (!record) {
        return res.status(400).send({ message: 'No valid records found' });
      }

      const userAssignedWarning = {
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
      };

      //if monitorData is passed and has a userId, meaning was sent from userprofile
      if (monitorData.userId) {
        const monitor = await UserProfile.findById(monitorData.userId);
        monitorData.firstName = monitor.firstName;
        monitorData.lastName = monitor.lastName;
        monitorData.email = monitor.email;
        monitorData.userId = monitor._id;
      }

      const updateData = warningsArray
        ? { $push: { warnings: { $each: warningsArray } } }
        : { $push: { warnings: { userId, iconId, color, date, description } } };

      const updatedWarnings = await UserProfile.findByIdAndUpdate({ _id: userId }, updateData, {
        new: true,
        upsert: true,
      });

      const { completedData, sendEmail, size } = filterWarnings(
        currentWarningDescriptions,
        updatedWarnings.warnings,
        iconId || null,
        color || null,
        issueBlueSquare,
      );

      const adminEmails = await getUserRoleByEmail(record);
      if (sendEmail !== null) {
        sendEmailToUser(
          sendEmail,
          description || null,
          userAssignedWarning,
          monitorData,
          size,
          adminEmails,
        );
      }

      res.status(201).send({ message: 'success', warnings: completedData });
    } catch (error) {
      console.log('error', error);
      res.status(400).send({ message: error.message || error });
    }
  };

  const deleteUsersWarnings = async (req, res) => {
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
    getSpecialWarnings,
    postWarningsToUserProfile,
    deleteUsersWarnings,
    postNewWarningsByUserId,
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
  let ordinal = null;
  let mostWarnings = null;
  if (typeof size === 'object') {
    mostWarnings = Math.max(...Object.values(size));
    ordinal = getOrdinal(mostWarnings);
  } else {
    getOrdinal(size);
  }

  const currentUserName = `${userAssignedWarning.firstName} ${userAssignedWarning.lastName}`;
  let emailTemplate = null;

  if (sendEmail === 'issue warning') {
    emailTemplate = `<p>Hello ${currentUserName},</p>
         <p>This is the <strong>${ordinal}</strong> time the Admin team has requested the same thing from you. Specifically, we <strong>${warningDescription}</strong>. Please carefully review the previous communications you’ve received to fully understand what is being requested. If anything is unclear, don’t hesitate to ask questions—the Admin team is here to assist.</p>
         <p>Moving forward, please ensure you don’t create situations where we need to keep doing this for you. Repeated requests for the same thing require unnecessary administrative attention and may result in a blue square being issued if it happens again.</p>
         <p>The Admin member who issued the warning is ${monitorData.firstName} ${monitorData.lastName} and their email is ${monitorData.email}. Please comment on your Google Doc and tag them using this email if you have any questions.</p>
         <p>With Gratitude,</p>
         <p>One Community</p>`;
  } else if (sendEmail === 'issue blue square') {
    emailTemplate = `<p>Hello ${currentUserName},</p>
    <p>A blue square has been issued because this is the ${ordinal} time the Admin team has requested the same thing from you. Specifically, we <strong>${warningDescription}</strong>.</p>
    <p>Moving forward, please ensure this is resolved. Repeated requests for the same thing require unnecessary administrative attention, will result in an additional blue square being issued, and could lead to termination.</p>
    <p>Please carefully review the previous communications you’ve received to fully understand what is being requested. If anything is unclear, feel free to ask questions—the Admin team is here to help.</p>
    <p>The Admin member who issued this blue square is ${monitorData.firstName} ${monitorData.lastName} and can be reached at ${monitorData.email}. If you have any questions, please comment on your Google Doc and tag them using this email.</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  } else if (sendEmail === 'issue two warnings blue square') {
    emailTemplate = `<p>Hello ${currentUserName},</p>
    <p>A blue square has been issued because this is the ${ordinal} time the Admin team has requested the same thing from you. Specifically, we have <strong>Removed Blue Square for No Summary</strong> (${size['Removed Blue Square for No Summary']} times) AND <strong>Removed Blue Square for Hours Close Enough</strong> (${size['Removed Blue Square for Hours Close Enough']} times).</p>
    <p>Moving forward, please ensure this is resolved. Repeated requests for the same thing require unnecessary administrative attention, will result in an additional blue square being issued, and could lead to termination.</p>
    <p>Please carefully review the previous communications you’ve received to fully understand what is being requested. If anything is unclear, feel free to ask questions—the Admin team is here to help.</p>
    <p>The Admin member who issued this blue square is ${monitorData.firstName} ${monitorData.lastName} and can be reached at ${monitorData.email}. If you have any questions, please comment on your Google Doc and tag them using this email.</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  } else if (sendEmail === 'issue two warnings') {
    emailTemplate = `<p>Hello ${currentUserName},</p>
    <p>This is the ${ordinal} time the Admin team has taken the same actions due to you not following our company’s protocols. Specifically, we have <strong>Removed Blue Square for No Summary</strong> (${size['Removed Blue Square for No Summary']} times) AND <strong>Removed Blue Square for Hours Close Enough</strong> (${size['Removed Blue Square for Hours Close Enough']} times).</p>
    <p>Please carefully review the previous communications you’ve received about this to fully understand what is being requested. If anything is unclear, don’t hesitate to ask questions, the Admin team is here to assist.</p>
    <p>Moving forward, please ensure this is resolved. Repeated requests for the same thing require unnecessary administrative attention, will result in an additional blue square being issued, and could lead to termination.</p>
    <p>Moving forward, please ensure you don’t create situations where we need to keep doing this for you. Repeated requests for the same thing require unnecessary administrative attention and will likely result in a blue square being issued if it happens again.</p>
    <p>The Admin member who issued this warning is ${monitorData.firstName} ${monitorData.lastName} and can be reached at ${monitorData.email}. If you have any questions, please comment on your Google Doc and tag them using this email.</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  }

  if (sendEmail === 'issue warning') {
    emailSender(
      `${userAssignedWarning.email}`,
      "IMPORTANT: Please read this email and take note so you don't get a blue square",
      emailTemplate,
      adminEmails.toString(),
      null,
    );
  } else if (sendEmail === 'issue blue square') {
    emailSender(
      `${userAssignedWarning.email}`,
      `IMPORTANT: You have been issued a blue square`,
      emailTemplate,
      adminEmails.toString(),
      null,
    );
  } else if (sendEmail === 'issue two warnings blue square') {
    emailSender(
      `${userAssignedWarning.email}`,
      `IMPORTANT: You have been issued a blue square`,
      emailTemplate,
      adminEmails.toString(),
      null,
    );
  } else if (sendEmail === 'issue two warnings') {
    emailSender(
      `${userAssignedWarning.email}`,
      `IMPORTANT: Please read this email and take note so you don’t get a blue square`,
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

const filterWarnings = (
  currentWarningDescriptions,
  usersWarnings,
  iconId = null,
  color = null,
  issueBlueSquare = null,
) => {
  const warningsObject = {};

  let sendEmail = null;
  let size = null;

  usersWarnings.forEach((warning) => {
    if (!warningsObject[warning.description]) {
      warningsObject[warning.description] = [];
    }
    warningsObject[warning.description].push(warning);

    if (!color && !iconId) {
      if (!sendEmail && issueBlueSquare) {
        sendEmail = 'issue two warnings blue square';
      } else if (!sendEmail && !issueBlueSquare) {
        sendEmail = 'issue two warnings';
      }
    } else {
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
    }
  });

  if (issueBlueSquare !== null) {
    size = {
      'Removed Blue Square for No Summary':
        warningsObject['Removed Blue Square for No Summary'].length,
      'Removed Blue Square for Hours Close Enough':
        warningsObject['Removed Blue Square for Hours Close Enough'].length,
    };
  }
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

  for (const { warningTitle, abbreviation } of currentWarningDescriptions) {
    completedData.push({
      title: warningTitle,
      warnings: warns[warningTitle] ? warns[warningTitle] : [],
      abbreviation: abbreviation ? abbreviation : null,
    });
  }
  return { completedData, sendEmail, size };
};

module.exports = warningsController;
