const mongoose = require("mongoose");
const userProfile = require("../models/userProfile");
const currentWarnings = require("../models/currentWarnings");

let currentWarningDescriptions = null;

// check user profile for caching the warnings
//see how they do it.
//check if its in cache if not then fetch it
// return cachce
//otherwise fetch and store the data and return it to the users'
//when deleteing on a warning should refresh the frontend even if it is opened
// the button

async function getWarningDescriptions() {
  currentWarningDescriptions = await currentWarnings.find(
    {},
    { warningTitle: 1, _id: 0 }
  );
}
// const descriptions = [
//   "Better Descriptions",
//   "Log Time to Tasks",
//   "Log Time as You Go",
//   "Log Time to Action Items",
//   "Intangible Time Log w/o Reason",
// ];

const convertObjectToArray = (obj) => {
  const arr = [];
  for (let key of obj) {
    // console.log("key", key);
    arr.push(key.warningTitle);
  }
  return arr;
};

const warningsController = function (UserProfile) {
  const getWarningsByUserId = async function (req, res) {
    currentWarningDescriptions = await currentWarnings.find(
      { activeWarning: true }
      // { warningTitle: 1, _id: 0 }
    );
    // console.log("currentWarningDescriptions", currentWarningDescriptions);

    currentWarningDescriptions = convertObjectToArray(
      currentWarningDescriptions
    );
    // console.log("currentWarningDescriptions", currentWarningDescriptions);
    const { userId } = req.params;

    try {
      const { warnings } = await UserProfile.findById(userId);

      const completedData = filterWarnings(
        currentWarningDescriptions,
        warnings
      );

      if (!warnings) {
        return res.status(400).send({ message: "no valiud records" });
      }
      res.status(201).send({ warnings: completedData });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  const postWarningsToUserProfile = async function (req, res) {
    try {
      const { userId } = req.params;

      const { iconId, color, date, description } = req.body;

      const record = await UserProfile.findById(userId);
      if (!record) {
        return res.status(400).send({ message: "No valid records found" });
      }
      console.log("req.body", req.body);
      console.log("req.record", record.warnings);

      // console.log("record", record.warnings);

      record.warnings = record.warnings.concat({
        userId,
        iconId,
        color,
        date,
        description,
      });

      await record.save();

      const completedData = filterWarnings(
        currentWarningDescriptions,
        record.warnings
      );

      res.status(201).send({ message: "success", warnings: completedData });
    } catch (error) {
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
        { new: true, upsert: true }
      );

      if (!warnings) {
        return res.status(400).send({ message: "no valid records" });
      }

      const sortedWarnings = filterWarnings(
        currentWarningDescriptions,
        warnings.warnings
      );
      res
        .status(201)
        .send({ message: "succesfully deleted", warnings: sortedWarnings });
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

// gests the dsecriptions key from the array
const getDescriptionKey = (val) => {
  //  currentWarningDescriptions = convertObjectToArray(currentWarningDescriptions);

  return currentWarningDescriptions.indexOf(val);
};

const sortKeysAlphabetically = (a, b) =>
  getDescriptionKey(a) - getDescriptionKey(b);

// method to see which color is first
const getColorIndex = (color) => {
  const colorOrder = ["blue", "yellow", "red"];
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

const filterWarnings = (currentWarningDescriptions, warnings) => {
  // console.log(
  //   "currentwanrings descriptions in filter",
  //   currentWarningDescriptions
  // );
  const warningsObject = {};

  warnings.forEach((warning) => {
    if (!warningsObject[warning.description]) {
      warningsObject[warning.description] = [];
    }
    warningsObject[warning.description].push(warning);
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
  return completedData;
};

module.exports = warningsController;
