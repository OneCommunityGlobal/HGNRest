import userProfile from 'models/userProfile';
import { showTrophyIcon } from 'utilities/trophyPermissions';
import moment from 'moment';
import actionItem from 'models/actionItem';

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs/promises");
const dashboardhelper = require("../helpers/dashboardhelper")();
const emailSender = require("../utilities/emailSender");

const dashboardcontroller = function () {
  const dashboarddata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);

    const snapshot = dashboardhelper.personaldetails(userId);

    snapshot.then((results) => {
      res.send(results).status(200);
    });
  };

  const monthlydata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const laborthismonth = dashboardhelper.laborthismonth(
      userId,
      req.params.fromDate,
      req.params.toDate
    );
    laborthismonth.then((results) => {
      if (!results || results.length === 0) {
        const emptyresult = [
          {
            projectName: "",
            timeSpent_hrs: 0,
          },
        ];
        res.status(200).send(emptyresult);
        return;
      }
      res.status(200).send(results);
    });
  };

  const weeklydata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const laborthisweek = dashboardhelper.laborthisweek(
      userId,
      req.params.fromDate,
      req.params.toDate
    );
    laborthisweek.then((results) => {
      res.send(results).status(200);
    });
  };

  const leaderboarddata = function (req, res) {
    const todaysDate = moment().tz('America/Los_Angeles').format('YYYY-MM-DD');
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const leaderboard = dashboardhelper.getLeaderboard(userId);
    leaderboard
      .then((results) => {
        if (results.length > 0) {
          results.forEach((item) => {
            if (!item.hideTrophyIcon) {
              item.trophyIconPresent = showTrophyIcon(todaysDate, item.createdDate.toISOString().split('T')[0]);
            }
          });
          res.status(200).send(results);
        } else {
          const { getUserLaborData } = dashboardhelper;
          getUserLaborData(userId).then((r) => {
            res.status(200).send(r);
          });
        }
      })
      .catch((error) => { console.log(error); res.status(400).send(error); });
  };

  const postTrophyIcon = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);

    userProfile.findById(userId, (err, record) => {
      if (err || !record) {
        res.status(404).send('No valid records found');
        return;
      }
      record.hideTrophyIcon = true;
      record.trophyIconPresent = false;

       record.save()
      .then((results) => {
        res.status(200).send(results);
      }).catch(error => res.status(404).send(error));
    });
  };

  const orgData = function (req, res) {
    const fullOrgData = dashboardhelper.getOrgData();

    fullOrgData
      .then((results) => {
        res.status(200).send(results[0]);
      })
      .catch((error) => res.status(400).send(error));
  };

  const getBugReportEmailBody = function (
    firstName,
    lastName,
    title,
    environment,
    reproduction,
    expected,
    actual,
    visual,
    severity
  ) {
    const text = `New Bug Report From <b>${firstName} ${lastName}</b>:
        <p>[Feature Name] Bug Title:</p>
        <p>${title}</p>
        <p>Environment (OS/Device/App Version/Connection/Time etc)</p>
        <p>${environment}</p>
        <p>Steps to reproduce (Please Number, Short Sweet to the point)</p>
        <p>${reproduction}</p>
        <p>Expected Result (Short Sweet to the point)</p>
        <p>${expected}</p>
        <p>Actual Result (Short Sweet to the point)</p>
        <p>${actual}</p>
        <p>Visual Proof (screenshots, videos, text)</p>
        <p>${visual}</p>
        <p>Severity/Priority (How Bad is the Bug?)</p>
        <p>${severity}</p>
        <p>Thank you,<br />
        One Community</p>`;

    return text;
  };

  const sendBugReport = function (req, res) {
    const {
      firstName,
      lastName,
      title,
      environment,
      reproduction,
      expected,
      actual,
      visual,
      severity,
      email,
    } = req.body;
    const emailBody = getBugReportEmailBody(
      firstName,
      lastName,
      title,
      environment,
      reproduction,
      expected,
      actual,
      visual,
      severity
    );

    try {
      emailSender(
        "onecommunityglobal@gmail.com",
        `Bug Rport from ${firstName} ${lastName}`,
        emailBody,
        email
      );
      res.status(200).send("Success");
    } catch {
      res.status(500).send("Failed");
    }
  };

  const suggestionData = {
    suggestion: [
      "Identify and remedy poor client and/or user service experiences",
      "Identify bright spots and enhance positive service experiences",
      "Make fundamental changes to our programs and/or operations",
      "Inform the development of new programs/projects",
      "Identify where we are less inclusive or equitable across demographic groups",
      "Strengthen relationships with the people we serve",
      "Understand people's needs and how we can help them achieve their goals",
      "Other",
    ],
    field: [],
  };

  const getsuggestionEmailBody = async (...args) => {
    let fieldaaray = [];
    if (suggestionData.field.length) {
      fieldaaray = suggestionData.field.map(
        (item) => `<p>${item}</p>
                   <p>${args[3][item]}</p>`
      );
    }
    const text = `New Suggestion:
      <p>Suggestion Category:</p>
      <p>${args[0]}</p>
      <p>Suggestion:</p>
      <p>${args[1]}</p>
      ${fieldaaray.length > 0 ? fieldaaray : ""}
      <p>Wants Feedback:</p>
      <p>${args[2]}</p>
      <p>Thank you,<br />
      One Community</p>`;

    return text;
  };

  // send suggestion email
  const sendMakeSuggestion = async (req, res) => {
    const { suggestioncate, suggestion, confirm, ...rest } = req.body;
    const emailBody = await getsuggestionEmailBody(
      suggestioncate,
      suggestion,
      confirm,
      rest
    );
    try {
      emailSender(
        "onecommunityglobal@gmail.com",
        "A new suggestion",
        emailBody
      );
      res.status(200).send("Success");
    } catch {
      res.status(500).send("Failed");
    }
  };

  const getSuggestionOption = async (req, res) => {
    try {
      if (suggestionData) {
        res.status(200).send(suggestionData);
      } else {
        res.status(404).send("Suggestion data not found.");
      }
    } catch (error) {
      console.error("Error getting suggestion data:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  const editSuggestionOption = async (req, res) => {
    try {
      if (req.body.suggestion) {
        if (req.body.action === "add") {
          suggestionData.suggestion.unshift(req.body.newField);
        }
        if (req.body.action === "delete") {
          suggestionData.suggestion = suggestionData.suggestion.filter(
            (item, index) => index + 1 !== +req.body.newField
          );
        }
      } else {
        if (req.body.action === "add") {
          suggestionData.field.unshift(req.body.newField);
        }
        if (req.body.action === "delete") {
          suggestionData.field = suggestionData.field.filter(
            (item) => item !== req.body.newField
          );
        }
      }

      res.status(200).send("success");
    } catch (error) {
      console.error("Error editing suggestion option:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  return {
    dashboarddata,
    monthlydata,
    weeklydata,
    leaderboarddata,
    orgData,
    sendBugReport,
    getSuggestionOption,
    editSuggestionOption,
    sendMakeSuggestion,
    postTrophyIcon,
  };
};

module.exports = dashboardcontroller;
