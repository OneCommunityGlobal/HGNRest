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

  const deleteWarningDescription = async (req, res) => {
    try {
      const { warningDescriptionId } = req.params;

      const response = await currentWarnings.findByIdAndDelete({
        _id: mongoose.Types.ObjectId(warningDescriptionId),
      });

      //don't send the response back
      //i couild but i have the id on the frontend already so i filter from that
      res.status(201).send({ response });

      // if (warnings.length === 0) {
      //   return res.status(400).send({ message: "no valid records" });
      // }

      // const filteredWarnings = warnings.filter(
      //   (warning) => warning._id.toString() !== warningDescriptionId.toString()
      // );
      // const newWarnings = new currentWarnings(...filteredWarnings);
      // await newWarnings.save();

      // console.log("newWarnings", newWarnings);
      // return res.status(201).send({ newWarnings });

      // console.log("warningDescriptionId", warningDescriptionId);
      // const response = await currentWarnings.findByIdAndDelete(
      //   mongoose.Types.ObjectId(warningDescriptionId)
      // );
      // console.log("response", response);
    } catch (err) {
      console.log("error", err);
    }
  };

  return {
    getCurrentWarnings,
    postNewWarningDescription,
    deleteWarningDescription,
  };
};
module.exports = currentWarningsController;
