const mongoose = require("mongoose");
const userProfile = require("../models/userProfile");

const currentWarningsController = function (currentWarnings) {
  const getCurrentWarnings = async (req, res) => {
    try {
      const response = await currentWarnings.find({});
      if (response.length === 0) {
        return res.status(400).send({ message: "no valid records" });
      }
      return res.status(201).send({ currentWarningDescriptions: response });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  const postNewWarningDescription = async (req, res) => {
    // post to the db using mongodb methods
    // search a method to post id will be generated

    try {
      const { newWarning, activeWarning } = req.body;

      const trimmedWarning = newWarning.trim();
      const warnings = await currentWarnings.find({});

      if (warnings.length === 0) {
        return res.status(400).send({ message: "no valid records" });
      }

      const duplicateFound = warnings.some(
        (warning) => warning.warningTitle === trimmedWarning
      );
      if (duplicateFound) {
        return res.status(422).send({ error: "warning already exists" });
      }

      const newWarningDescription = new currentWarnings();
      newWarningDescription.warningTitle = trimmedWarning;
      newWarningDescription.activeWarning = activeWarning;

      warnings.push(newWarningDescription);
      await newWarningDescription.save();

      return res.status(201).send({ newWarnings: warnings });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
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

      const updatedWarningDescription = {
        _id: response._id,
        activeWarning: response.activeWarning,
      };

      res.status(201).send(updatedWarningDescription);
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  // delete will delete the  warning and all warnings assocaited with it
  const deleteWarningDescription = async (req, res) => {
    try {
      const { warningDescriptionId } = req.params;
      console.log("warningDescriptionId", warningDescriptionId);
      // Find the document to be deleted
      const documentToDelete = await currentWarnings.findById(
        warningDescriptionId
      );

      await currentWarnings.deleteOne({
        _id: mongoose.Types.ObjectId(warningDescriptionId),
      });

      const deletedDescription = documentToDelete.warningTitle;

      // deletes all warnings from users too
      //look into why this works

      await userProfile.updateMany(
        {
          "warnings.description": deletedDescription,
        },
        {
          $pull: {
            warnings: { description: deletedDescription },
          },
        }
      );
      // .then((response) => console.log("res", response));

      res.status(200).send({
        message:
          "warning description was successfully deleted and user profiles updated",
      });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
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
