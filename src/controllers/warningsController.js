const mongoose = require("mongoose");
const userProfile = require("../models/userProfile");

const warningsController = function (UserProfile) {
  // check to see how to add an array caleld warnigns to the abckend
  // anc check if its being saved when posting
  // change post to a put instead as I am saving data that exisits.

  //getting the warnings will be done in dashboard or a top component
  //or when clicking the tracking button

  const getWarningsByUserId = async function (req, res) {
    const { id } = req.params;

    // console.log("id when searching", id);
    // const { roleId } = req.params;
    const descriptions = [
      "Better Descriptions",
      "Log Time to Tasks",
      "Log Time as You Go",
      "Log Time to Action Items",
      "Intangible Time Log w/o Reason",
    ];

    // filter from the backend
    //deseription first then color red blue white
    //then fill out the rest on the front end
    //send back array of obejcts fitler by the descriptions and the color
    // so on the front end i just have to map over the description and displa
    // each warnign with their details
    //look up freqwuncy algorithm counter
    // to group the descrioptions and group all the wanrings

    // {

    // description : [{color id, date} ]

    // }
    try {
      const { warnings } = await UserProfile.findById(id);

      console.log("user profile", warnings);

      let betterDescriptions = warnings.filter(
        (warning) => warning.description === "Better Descriptions"
      );
      betterDescriptions = betterDescriptions.sort(sortByColorAndDate);

      // let logTimeToTasks = warnings.filter(
      //   (warning) => warning.description === "Log Time to Tasks"
      // );
      // betterDescriptions = betterDescriptions.sort(logTimeToTasks);

      const data = [
        {
          title: "Better Descriptions",
          warnings: betterDescriptions,
        },
        // { title: "Log Time to Tasks", warnings: logTimeToTasks },
      ];
      // console.log(betterDescriptions);
      // console.log("warnings on the backend", warnings);
      if (!warnings) {
        return res.status(400).send({ message: "no valiud records" });
      }
      res.status(201).send({ warnings: data });
    } catch (err) {
      res.status(400).send({ message: error.message || error });
    }
    // UserProfile.findById(userId)
    //   .then((results) => res.status(200).send(results))
    //   .catch((error) => res.status(404).send({ error }));
    // res.status(200).json({ message: "test message" });
  };

  const postWarningsToUserProfile = async function (req, res) {
    console.log("POST WARNINGS WAS CALLED");

    try {
      // console.log("inside of try");
      const { userId, iconId, color, date, description } = req.body;

      const record = await UserProfile.findById(userId);
      if (!record) {
        return res.status(400).send({ message: "No valid records found" });
      }

      record.warnings = record.warnings.concat({
        userId,
        iconId,
        color,
        date,
        description,
      });

      await record.save();

      // console.log("record warnings", record.warnings);

      let betterDescriptions = record.warnings.filter(
        (warning) => warning.description === "Better Descriptions"
      );
      betterDescriptions = betterDescriptions.sort(sortByColorAndDate);
      const data = [
        {
          title: "Better Descriptions",
          warnings: betterDescriptions,
        },
      ];

      res.status(201).send({ message: "success", warnings: data });
    } catch (error) {
      res.status(400).send({ message: error.message || error });
    }
    // UserProfile.findById(userId, (error, record) => {
    //   if (error || record === null) {
    //     res.status(400).send("No valid records found");
    //     return;
    //   }
    //   // console.log("record before", record);

    //   record.warnings = record.warnings.concat({
    //     userId,
    //     iconId,
    //     color,
    //     date,
    //     description,
    //   });

    //   console.log("record", record.warnings);
    //   record
    //     .save()
    //     .then((results) => res.status(201).send({ message: "succes", results }))
    //     .catch((errors) => res.status(400).send(errors));
    // });

    // const foundUser = await UserProfile.findById({ _id: userId }, "");
    // foundUser
    // console.log("posting warnigns to user profile was called ", foundUser);
    // console.log("posting warnigns to user profile was called ", req.body);
    // res.status(200).json({ message: "testing post warning to user profile" });
  };

  const deleteUsersWarnings = async (req, res) => {
    const { id } = req.params;

    try {
      const warnings = await UserProfile.findOneAndUpdate(
        {
          _id: id,
        },
        {
          $set: {
            warnings: [],
          },
        }
      );

      if (!warnings) {
        return res.status(400).send({ message: "no valiud records" });
      }
      res.status(201).send({ message: "succesfully deleted" });
    } catch (err) {
      res.status(400).send({ message: error.message || error });
    }
  };

  return {
    getWarningsByUserId,
    postWarningsToUserProfile,
    deleteUsersWarnings,
  };
};

// will have to sort by date if the color is the same

//method to see which color is first
const getColorIndex = (color) => {
  const colorOrder = ["red", "blue"];
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
module.exports = warningsController;
