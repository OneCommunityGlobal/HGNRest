const userProfile = require("../models/userProfile");
const mongoose = require("mongoose");

const descriptions = [
  "Better Descriptions",
  "Log Time to Tasks",
  "Log Time as You Go",
  "Log Time to Action Items",
  "Intangible Time Log w/o Reason",
];
const warningsController = function (UserProfile) {
  // check to see how to add an array caleld warnigns to the abckend
  // anc check if its being saved when posting
  // change post to a put instead as I am saving data that exisits.

  // getting the warnings will be done in dashboard or a top component
  // or when clicking the tracking button

  const getWarningsByUserId = async function (req, res) {
    const { userId } = req.params;

    // filter from the backend
    // deseription first then color red blue white
    // then fill out the rest on the front end
    // send back array of obejcts fitler by the descriptions and the color
    // so on the front end i just have to map over the description and displa
    // each warnign with their details
    // look up freqwuncy algorithm counter
    // to group the descrioptions and group all the wanrings

    try {
      const { warnings } = await UserProfile.findById("userid");

      const completedData = filterWarnings(warnings);

      //TODO
      //posting warning needs to be changed and fitleedd when sending
      //just like when getting the data
      //next a modal on the frontend to make sure a warnign is being assigned
      //if cancled revoke everything
      //if warning will be issued send the data after confirmation
      //

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
      // find out why its not breaking when posting a warning
      // id is being logged inside of theparams
      //should be userId isntead
      //when posting if undefiend it should error
      // and send back the error response
      //move onto deleting a warning
      //break it and catch the error
      const { iconId, color, date, description } = req.body;

      console.log("Posting called", color);
      const record = await UserProfile.findById(userId);
      if (!record) {
        return res.status(400).send({ message: "No valid records found" });
      }
      console.log("record", record.warnings);

      record.warnings = record.warnings.concat({
        userId,
        iconId,
        color,
        date,
        description,
      });
      await record.save();

      const completedData = filterWarnings(record.warnings);

      res.status(201).send({ message: "success", warnings: completedData });
    } catch (error) {
      res.status(400).send({ message: error.message || error });
    }
  };

  const deleteUsersWarnings = async (req, res) => {
    // console.log("inside of delete warning");
    // console.log("req.body", req.body);
    // console.log("req.params", req.params);
    const { userId } = req.params;
    const { warningId } = req.body;

    console.log("warning id", warningId);
    //warning id odesnt return null if it deosnt find it.
    //it returns the original array
    //i wonder because its searching the obejct as a whole
    //then searches inside teh warnings array
    try {
      const warnings = await UserProfile.findOneAndUpdate(
        { _id: userId },
        { $pull: { warnings: { _id: warningId } } },
        { new: true, upsert: true }
      );

      if (!warnings) {
        console.log("No document found or created.");
      } else {
        console.log("Updated document:", warnings.warnings);
      }

      if (!warnings) {
        return res.status(400).send({ message: "no valid records" });
      }

      const sortedWarnings = filterWarnings(warnings.warnings);
      res
        .status(201)
        .send({ message: "succesfully deleted", warnings: sortedWarnings });
    } catch (error) {
      console.log("error", error);
      res.status(400).send({ message: error.message || error });
    }
  };

  return {
    getWarningsByUserId,
    postWarningsToUserProfile,
    deleteUsersWarnings,
  };
};

//gests the dsecriptions key from the array
const getDescriptionKey = (val) => {
  const descriptions = [
    "Better Descriptions",
    "Log Time to Tasks",
    "Log Time as You Go",
    "Log Time to Action Items",
    "Intangible Time Log w/o Reason",
  ];

  return descriptions.indexOf(val);
};

const sortKeysAlphabetically = (a, b) => {
  return getDescriptionKey(a) - getDescriptionKey(b);
};

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

const filterWarnings = (warnings) => {
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

  for (let keys of Object.keys(warns)) {
    warns[keys] = warns[keys].sort(sortByColorAndDate);
  }

  const completedData = [];

  for (let descrip of descriptions) {
    completedData.push({
      title: descrip,
      warnings: warns[descrip] ? warns[descrip] : [],
    });
  }
  return completedData;
};

module.exports = warningsController;
