const mongoose = require("mongoose");
const reporthelper = require("../helpers/reporthelper")();
const { hasPermission } = require("../utilities/permissions");
const UserProfile = require("../models/userProfile");
const userhelper = require("../helpers/userHelper")();

const reportsController = function () {
  const getWeeklySummaries = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, "getWeeklySummaries"))) {
      res.status(403).send("You are not authorized to view all users");
      return;
    }

    reporthelper
      .weeklySummaries(3, 0)
      .then((results) => {
        const summaries = reporthelper.formatSummaries(results);
        res.status(200).send(summaries);
      })
      .catch((error) => res.status(404).send(error));
  };

  /**
   * Gets the Recipients added by the owner to receive the Weekly Summary Reports
   * @param {*} req
   * @param {*} res
   */

  const getReportRecipients = function (req, res) {
    try {
      UserProfile.find(
        { getWeeklyReport: true },
        {
          email: 1,
          firstName: 1,
          lastName: 1,
          createdDate: 1,
          getWeeklyReport: 1,
        }
      )
        .then((results) => {
          res.status(200).send(results);
        })
        .catch((error) => {
          console.log("error:", error); //need to delete later *
          res.status(404).send({ error });
        });
    } catch (err) {
      console.log("error:", err); //need to delete later *
      res.status(404).send(err);
    }
  };

  /**
   * Function deletes slected Recipients from the list
   * @param {*} req
   * @param {*} res
   * @returns
   */
  const deleteReportsRecepients = (req, res) => {
    const { userid } = req.params;
    const id = userid;
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({
          msg: `No task with id :${id}`,
        });
      }

      UserProfile.updateOne({ _id: id }, { $set: { getWeeklyReport: false } })
        .then((record) => {
          if (!record) {
            console.log("'No valid records found'");
            res.status(404).send("No valid records found");
            return;
          }
          res.status(200).send({
            message: "updated user record with getWeeklyReport false",
          });
        })
        .catch((err) => {
          console.log("error in catch block last:", err);
          res.status(404).send(err);
        });
    } catch (error) {
      res.status(404).send(error);
    }
  };

  const saveReportsRecepients = (req, res) => {
    const { userid } = req.params;
    const id = userid;
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({
          msg: `No task with id :${id}`,
        });
      }

      UserProfile.updateOne({ _id: id }, { $set: { getWeeklyReport: true } })
        .then((record) => {
          if (!record) {
            console.log("'No valid records found'");
            res.status(404).send("No valid records found");
            return;
          }
          res
            .status(200)
            .send({ message: "updated user record with getWeeklyReport true" });
        })
        .catch((err) => {
          console.log("error in catch block last:", err);
          res.status(404).send(err);
        });
    } catch (error) {
      res.status(404).send(error);
    }
  };

  return {
    getWeeklySummaries,
    getReportRecipients,
    deleteReportsRecepients,
    saveReportsRecepients,
  };
};

module.exports = reportsController;
