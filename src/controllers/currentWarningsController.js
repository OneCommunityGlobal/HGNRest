const mongoose = require("mongoose");

const currentWarningsController = function (currentWarnings) {
  const getCurrentWarnings = async (req, res) => {
    try {
      const response = await currentWarnings.find({});
      if (response.length === 0) {
        return res.status(400).send({ message: "no valid records" });
      }
      return res.status(201).send({ currentWarningDescriptions: response });
    } catch (error) {
      console.log("error", error);
    }
  };

  const postNewWarningDescription = async (req, res) => {
    //post to the db using mongodb methods
    //search a method to post id will be generated
    try {
      const { newWarning, activeWarning } = req.body;

      const warnings = await currentWarnings.find({});

      if (warnings.length === 0) {
        return res.status(400).send({ message: "no valid records" });
      }

      const newWarningDescription = new currentWarnings();
      newWarningDescription.warningTitle = newWarning;
      newWarningDescription.activeWarning = activeWarning;

      warnings.push(newWarningDescription);
      await newWarningDescription.save();

      return res.status(201).send({ newWarnings: warnings });
    } catch (err) {
      console.log("error", err);
    }
  };

  const updateWarningDescription = async (req, res) => {
    try {
      const { warningDescriptionId } = req.params;

      const response = await currentWarnings.findOneAndUpdate(
        { _id: warningDescriptionId },
        [{ $set: { activeWarning: { $not: "$activeWarning" } } }],
        { new: true }
      );

      console.log("response", response);
      const updatedWarningDescription = {
        _id: response._id,
        activeWarning: response.activeWarning,
      };

      res.status(201).send(updatedWarningDescription);
    } catch (err) {
      console.log("error", err);
    }
  };

  //delete will delete the  warning and all warnings assocaited with it
  const deleteWarningDescription = async (req, res) => {
    try {
      // if (!(await hasPermission(req.body.requestor, 'deleteBadges'))) {
      //   res
      //     .status(403)
      //     .send({ error: 'You are not authorized to delete badges.' });
      //   return;
      // }
      // const { badgeId } = req.params;
      // Badge.findById(badgeId, (error, record) => {
      //   if (error || record === null) {
      //     res.status(400).send({ error: 'No valid records found' });
      //     return;
      //   }
      //   const removeBadgeFromProfile = UserProfile.updateMany(
      //     {},
      //     { $pull: { badgeCollection: { badge: record._id } } },
      //   ).exec();
      //   const deleteRecord = record.remove();

      //   Promise.all([removeBadgeFromProfile, deleteRecord])
      //     .then(
      //       res.status(200).send({
      //         message: 'Badge successfully deleted and user profiles updated',
      //       }),
      //     )
      //     .catch((errors) => {
      //       res.status(500).send(errors);
      //     });

      const { warningDescriptionId } = req.params;

      await currentWarnings.deleteOne({
        _id: mongoose.Types.ObjectId(warningDescriptionId),
      });

      // will delete all corresponding warnings on each user
      //new feature and needs to incorpoarted

      // console.log("response", response);

      //don't send the response back
      //i couild but i have the id on the frontend already so i filter from that
      //sends back the updated reponse
      //on the frontend i'll return a new array with the updated paramter
      //then add a grey coloring to the text and a new button of + to re add it
      //will need another route to conenct it
      //can be an update route
      res.status(200).send({
        message:
          "warning description was successfully deleted and user profiles updated",
      });
    } catch (err) {
      console.log("error", err);
    }
  };

  return {
    getCurrentWarnings,
    postNewWarningDescription,
    updateWarningDescription,
    deleteWarningDescription,
  };
};
module.exports = currentWarningsController;
