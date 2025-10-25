/* eslint-disable no-restricted-syntax */
// eslint-disable-next-line no-unused-vars
const mongoose = require('mongoose');
// eslint-disable-next-line no-unused-vars
const userProfile = require('../models/userProfile');
const currentWarnings = require('../models/currentWarnings');
const emailSender = require('../utilities/emailSender');
const userHelper = require('../helpers/userHelper')();
const BlueSquareEmailAssignment = require('../models/BlueSquareEmailAssignment');

let currentWarningDescriptions = null;
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

// helper to get the team members admin emails
async function getUserRoleByEmail(user) {
  const recipients = ['jae@onecommunityglobal.org'];
  for (const teamId of user.teams) {
    // eslint-disable-next-line no-await-in-loop
    const managementEmails = await userHelper.getTeamManagementEmail(teamId);
    if (Array.isArray(managementEmails) && managementEmails.length > 0) {
      managementEmails.forEach((management) => {
        recipients.push(management.email);
      });
    }
  }

  return [...new Set(recipients)];
}

// helper function to get the ordinal
function getOrdinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = n % 100;
  return n + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
}
const sendEmailToUser = async (
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
    if (sendEmail === 'issue warning and blue square') {
      mostWarnings = size['Removed Blue Square for Hours Close Enough'];
    } else if (sendEmail === 'issue blue square and warning') {
      mostWarnings = size['Removed Blue Square for No Summary'];
    } else {
      mostWarnings = Math.max(...Object.values(size));
    }
    ordinal = getOrdinal(mostWarnings);
  } else {
    ordinal = getOrdinal(size);
  }

  const currentUserName = `${userAssignedWarning.firstName} ${userAssignedWarning.lastName}`;
  let emailTemplate = null;
  let subject = null;
  let bccList;

  const blueSquareBCCs = await BlueSquareEmailAssignment.find().populate('assignedTo').exec();
  if (Array.isArray(blueSquareBCCs) && blueSquareBCCs.length > 0) {
    bccList = blueSquareBCCs.filter((bcc) => bcc.assignedTo?.isActive).map((bcc) => bcc.email);
  }

  if (sendEmail === 'issue warning') {
    subject = "IMPORTANT: Please read this email and take note so you don't get a blue square";
    bccList = null;
    emailTemplate = `<p>Hello ${currentUserName},</p>
         <p>This is the <strong>${ordinal}</strong> time the Admin team has requested the same thing and/or had to make the same change for you; <strong>${warningDescription}</strong>. Please carefully review the previous communications you’ve received to fully understand what is being requested. If anything is unclear, don’t hesitate to ask questions—the Admin team is here to assist.</p>
         <p>Moving forward, please ensure you don’t create situations where we need to keep doing this for you. Repeated requests for the same thing require unnecessary administrative attention and may result in a blue square being issued if it happens again.</p>
         <p>The Admin member who issued the warning is ${monitorData.firstName} ${monitorData.lastName} and their email is ${monitorData.email}. Please comment on your Google Doc and tag them using this email if you have any questions.</p>
         <p>With Gratitude,</p>
         <p>One Community</p>`;
  } else if (sendEmail === 'issue blue square') {
    subject = `IMPORTANT: You have been issued a blue square`;
    emailTemplate = `<p>Hello ${currentUserName},</p>
    <p>A blue square has been issued because this is the <strong>${ordinal}</strong> time the Admin team has requested the same thing and/or had to make the same change for you; <strong>${warningDescription}</strong>.</p>
    <p>Moving forward, please ensure this is resolved. Repeated requests for the same thing require unnecessary administrative attention, will result in an additional blue square being issued, and could lead to termination.</p>
    <p>Please carefully review the previous communications you’ve received to fully understand what is being requested. If anything is unclear, feel free to ask questions—the Admin team is here to help.</p>
    <p>The Admin member who issued this blue square is ${monitorData.firstName} ${monitorData.lastName} and can be reached at ${monitorData.email}. If you have any questions, please comment on your Google Doc and tag them using this email.</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  } else if (sendEmail === 'issue two warnings blue square') {
    subject = `IMPORTANT: You have been issued a blue square`;
    emailTemplate = `<p>Hello ${currentUserName},</p>
    <p>A blue square has been issued because this is the <strong>${ordinal}</strong> time the Admin team has requested the same thing from you. Specifically, we have <strong>Removed Blue Square for No Summary</strong> (${size['Removed Blue Square for No Summary']} times) AND <strong>Removed Blue Square for Hours Close Enough</strong> (${size['Removed Blue Square for Hours Close Enough']} times).</p>
    <p>Moving forward, please ensure this is resolved. Repeated requests for the same thing require unnecessary administrative attention, will result in an additional blue square being issued, and could lead to termination.</p>
    <p>Please carefully review the previous communications you’ve received to fully understand what is being requested. If anything is unclear, feel free to ask questions—the Admin team is here to help.</p>
    <p>The Admin member who issued this blue square is ${monitorData.firstName} ${monitorData.lastName} and can be reached at ${monitorData.email}. If you have any questions, please comment on your Google Doc and tag them using this email.</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  } else if (sendEmail === 'issue two warnings') {
    subject = `IMPORTANT: Please read this email and take note so you don’t get a blue square`;
    bccList = null;
    emailTemplate = `<p>Hello ${currentUserName},</p>
    <p>This is the <strong>${ordinal}</strong> time the Admin team has taken the same actions due to you not following our company’s protocols. Specifically, we have <strong>Removed Blue Square for No Summary</strong> (${size['Removed Blue Square for No Summary']} times) AND <strong>Removed Blue Square for Hours Close Enough</strong> (${size['Removed Blue Square for Hours Close Enough']} times).</p>
    <p>Please carefully review the previous communications you’ve received about this to fully understand what is being requested. If anything is unclear, don’t hesitate to ask questions, the Admin team is here to assist.</p>
    <p>Moving forward, please ensure this is resolved. Repeated requests for the same thing require unnecessary administrative attention, will result in an additional blue square being issued, and could lead to termination.</p>
    <p>Moving forward, please ensure you don’t create situations where we need to keep doing this for you. Repeated requests for the same thing require unnecessary administrative attention and will likely result in a blue square being issued if it happens again.</p>
    <p>The Admin member who issued this warning is ${monitorData.firstName} ${monitorData.lastName} and can be reached at ${monitorData.email}. If you have any questions, please comment on your Google Doc and tag them using this email.</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  } else if (sendEmail === 'issue warning and blue square') {
    subject = `IMPORTANT: You have been issued a blue square and a warning`;
    emailTemplate = `<p>Hello ${currentUserName},</p>
    <p>A blue square has been issued because this is the <strong>${ordinal}</strong> time the Admin team has requested the same thing from you, specifically, <strong>Removed Blue Square for Hours Close Enough</strong>. We have also issued a warning for reminding you repeatedly about <strong>Removed Blue Square for No Summary</strong> (${size['Removed Blue Square for No Summary']} times) </p>
    <p>Moving forward, please ensure this is resolved. Repeated requests for the same thing require unnecessary administrative attention, will result in an additional blue square being issued, and could lead to termination.</p>
    <p>Please carefully review the previous communications you’ve received to fully understand what is being requested. If anything is unclear, feel free to ask questions—the Admin team is here to help.</p>
    <p>The Admin member who issued this blue square is ${monitorData.firstName} ${monitorData.lastName} and can be reached at ${monitorData.email}. If you have any questions, please comment on your Google Doc and tag them using this email.</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  } else if (sendEmail === 'issue blue square and warning') {
    subject = `IMPORTANT: You have been issued a blue square and a warning`;
    emailTemplate = `<p>Hello ${currentUserName},</p>
    <p>A blue square has been issued because this is the <strong>${ordinal}</strong> time the Admin team has requested the same thing from you, specifically, <strong>Removed Blue Square for No Summary</strong>. We have also issued a warning for reminding you repeatedly about <strong>Removed Blue Square for Hours Close Enough</strong> (${size['Removed Blue Square for Hours Close Enough']} times).</p>
    <p>Moving forward, please ensure this is resolved. Repeated requests for the same thing require unnecessary administrative attention, will result in an additional blue square being issued, and could lead to termination.</p>
    <p>Please carefully review the previous communications you’ve received to fully understand what is being requested. If anything is unclear, feel free to ask questions—the Admin team is here to help.</p>
    <p>The Admin member who issued this blue square is ${monitorData.firstName} ${monitorData.lastName} and can be reached at ${monitorData.email}. If you have any questions, please comment on your Google Doc and tag them using this email.</p>
    <p>With Gratitude,</p>
    <p>One Community</p>`;
  }

  emailSender(
    `${userAssignedWarning.email}`,
    subject,
    emailTemplate,
    null,
    adminEmails.toString(),
    `${userAssignedWarning.email}`, // make individual the reply-to, for CC'd/BCC'd replies
    Array.isArray(bccList) ? [...new Set([...bccList])] : null,
  );
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
  warningDescriptions,
  warnings,
  iconId = null,
  color = null,
  issueBlueSquare = {},
) => {
  const warningsObject = {};
  const blueSquareCount = Object.values(issueBlueSquare).filter(Boolean).length;

  let sendEmail = null;
  let size = null;

  warnings.forEach((warning) => {
    if (!warningsObject[warning.description]) {
      warningsObject[warning.description] = [];
    }
    warningsObject[warning.description].push(warning);

    if (!color && !iconId) {
      if (!sendEmail) {
        if (blueSquareCount === 2) {
          sendEmail = 'issue two warnings blue square';
        } else if (blueSquareCount === 1) {
          if (issueBlueSquare['Blu Sq Rmvd - For No Summary'] === true) {
            sendEmail = 'issue blue square and warning';
          } else {
            sendEmail = 'issue warning and blue square';
          }
        } else {
          sendEmail = 'issue two warnings';
        }
      }
    } else if (
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

  if (Object.keys(issueBlueSquare).length !== 0) {
    size = {
      'Removed Blue Square for No Summary': warningsObject['Blu Sq Rmvd - For No Summary'].length,
      'Removed Blue Square for Hours Close Enough':
        warningsObject['Blu Sq Rmvd - Hrs Close Enoug'].length,
    };
  }
  const warns = Object.keys(warningsObject)
    .sort(sortKeysAlphabetically)
    .reduce((acc, cur) => {
      acc[cur] = warningsObject[cur];
      return acc;
    }, {});

  Object.keys(warns).forEach((keys) => {
    warns[keys] = warns[keys].sort(sortByColorAndDate);
  });

  const completedData = [];

  for (const { warningTitle, abbreviation } of warningDescriptions) {
    completedData.push({
      title: warningTitle,
      warnings: warns[warningTitle] ? warns[warningTitle] : [],
      abbreviation: abbreviation || null,
    });
  }

  return { completedData, sendEmail, size };
};

const warningsController = function (UserProfile) {
  const getWarningsByUserId = async function (req, res) {
    if (!currentWarningDescriptions) {
      await getWarningDescriptions();
    }

    const { userId } = req.params;

    try {
      const record = await UserProfile.findById(userId);

      if (!record || !record.warnings) {
        return res.status(400).send({ message: 'no valiud records' });
      }

      const { completedData } = filterWarnings(currentWarningDescriptions, record.warnings);
      return res.status(201).send({ warnings: completedData });
    } catch (error) {
      return res.status(401).send({ message: error.message || error });
    }
  };

  // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line array-callback-return
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

  // eslint-disable-next-line no-unused-vars
  const postWarningsToUserProfile = async function (req, res, next) {
    if (!currentWarningDescriptions) {
      await getWarningDescriptions();
    }
    try {
      const { userId } = req.params;
      const { warningsArray, issueBlueSquare, monitorData, iconId, color, date, description } =
        req.body;

      const record = await UserProfile.findById(userId);

      if (!record || !record.warnings) {
        return res.status(400).send({ message: 'No valid records found' });
      }

      const userAssignedWarning = {
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
      };

      // if monitorData is passed and has a userId, meaning was sent from userprofile
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

      let updatedDescription =
        description === 'Blu Sq Rmvd - Hrs Close Enoug'
          ? 'Removed Blue Square for Hours Close Enough'
          : description;
      updatedDescription =
        updatedDescription === 'Blu Sq Rmvd - For No Summary'
          ? 'Removed Blue Square for No Summary'
          : updatedDescription;

      const adminEmails = await getUserRoleByEmail(record);
      if (sendEmail !== null) {
        sendEmailToUser(
          sendEmail,
          updatedDescription || null,
          userAssignedWarning,
          monitorData,
          size,
          adminEmails,
        );
      }

      return res.status(201).send({ message: 'success', warnings: completedData });
    } catch (error) {
      return res.status(400).send({ message: error.message || error });
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
      return res.status(201).send({ message: 'succesfully deleted', warnings: completedData });
    } catch (error) {
      return res.status(401).send({ message: error.message || error });
    }
  };

  return {
    getWarningsByUserId,
    getSpecialWarnings,
    postWarningsToUserProfile,
    deleteUsersWarnings,
  };
};

module.exports = warningsController;
