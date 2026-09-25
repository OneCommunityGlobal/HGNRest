/* eslint-disable no-restricted-syntax */
const userProfile = require('../models/userProfile');
const currentWarnings = require('../models/currentWarnings');
const userHelper = require('../helpers/userHelper')();
const warningsHelper = require('../helpers/warningsHelper');
const {
  clearOutdatedWarningsFlag,
  areWarningsInfoOutdated,
} = require('../utilities/warningsCache');

let currentWarningDescriptions = null;
async function getWarningDescriptions() {
  currentWarningDescriptions = await currentWarnings
    .find({ activeWarning: true }, { warningTitle: 1, _id: 1, abbreviation: 1, order: 1 })
    .sort({ order: 1 });
  clearOutdatedWarningsFlag();
}

const checkWarningDescriptions = async () => {
  const warningsOutdated = areWarningsInfoOutdated();
  if (!currentWarningDescriptions || warningsOutdated) {
    await getWarningDescriptions();
  }
};

const convertObjectToArray = (obj) => {
  const arr = [];
  for (const key of obj) {
    arr.push(key.warningTitle);
  }
  return arr;
};

const checkIfWarningDescriptionMatchesWarningTrackerTitle = (warnings) => {
  for (const { warningTitle, _id } of currentWarningDescriptions) {
    warnings = warnings.map((warning) => {
      // If warning has a warningId but description of warning does not match tracker's title, then the warning description is updated
      if (_id.toString() === warning?.warningId && warningTitle !== warning?.description) {
        return { ...warning, description: warningTitle };
      }
      return warning;
    });
  }
  return warnings;
};

const updateWarningsMissingTrackerId = (warnings) => {
  for (const { warningTitle, _id } of currentWarningDescriptions) {
    warnings = warnings.map((warning) => {
      if (!warning?.warningId && warningTitle === warning?.description) {
        return { ...warning, warningId: _id };
      }
      return warning;
    });
  }
  return warnings;
};

const warningsController = function (UserProfile) {
  const getWarningsByUserId = async function (req, res) {
    await checkWarningDescriptions();

    const { userId } = req.params;

    try {
      const record = await UserProfile.findById(userId).lean();

      if (!record || !record.warnings) {
        return res.status(400).send({ message: 'no valiud records' });
      }

      const warningsList = record.warnings;
      const updatedWarningsList = checkIfWarningDescriptionMatchesWarningTrackerTitle(warningsList);

      const userWarnings = updateWarningsMissingTrackerId(updatedWarningsList);

      await userProfile.findByIdAndUpdate(
        record._id,
        { $set: { warnings: userWarnings } },
        { new: true },
      );

      const { completedData } = warningsHelper.filterWarnings(
        currentWarningDescriptions,
        userWarnings,
      );
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

      const { completedData } = warningsHelper.filterWarnings(specialWarningsObj, filteredWarnings);

      return res.status(201).send({ message: 'success', warnings: completedData });
    } catch (error) {
      // Error handled
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
      let warningId = '';
      for (const { warningTitle, _id } of currentWarningDescriptions) {
        if (warningTitle === description) {
          warningId = _id;
        }
      }
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
        : { $push: { warnings: { userId, iconId, color, date, description, warningId } } };

      const updatedWarnings = await UserProfile.findByIdAndUpdate({ _id: userId }, updateData, {
        new: true,
        upsert: true,
      });

      const { completedData, sendEmail, size } = warningsHelper.filterWarnings(
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

      const adminEmails = await userHelper.getUserRoleByEmail(record);
      if (sendEmail !== null) {
        warningsHelper.sendEmailToUser(
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

      const { completedData } = warningsHelper.filterWarnings(
        currentWarningDescriptions,
        warnings.warnings,
      );
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
