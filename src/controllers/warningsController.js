const mongoose = require("mongoose");
const userProfile = require("../models/userProfile");

const warningsController = function (UserProfile) {
  // check to see how to add an array caleld warnigns to the abckend
  // anc check if its being saved when posting
  // change post to a put instead as I am saving data that exisits.

  //getting the warnings will be done in dashboard or a top component
  //or when clicking the tracking button

  const getWarningsByUserId = async function (req, res) {
    console.log("get warning called", req.body);

    const { userId } = req.body;

    // const { roleId } = req.params;
    UserProfile.findById(userId)
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send({ error }));
    res.status(200).json({ message: "test message" });
  };

  const postWarningsToUserProfile = async function (req, res) {
    console.log("body", req.body);
    const { userId, iconId, color, date, description } = req.body;
    // console.log("user id", userId, iconId, color, dateAssigned);

    UserProfile.findById(userId, (error, record) => {
      if (error || record === null) {
        res.status(400).send("No valid records found");
        return;
      }
      // console.log("record before", record);

      record.warnings = record.warnings.concat({
        userId,
        iconId,
        color,
        date,
        description,
      });

      console.log("record", record.warnings);
      record
        .save()
        .then((results) => res.status(201).send({ message: "succes", results }))
        .catch((errors) => res.status(400).send(errors));
    });

    // const foundUser = await UserProfile.findById({ _id: userId }, "");
    // foundUser
    // console.log("posting warnigns to user profile was called ", foundUser);
    // console.log("posting warnigns to user profile was called ", req.body);
    // res.status(200).json({ message: "testing post warning to user profile" });
  };

  return {
    getWarningsByUserId,
    postWarningsToUserProfile,
  };
};

module.exports = warningsController;
