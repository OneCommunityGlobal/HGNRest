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
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const leaderboard = dashboardhelper.getLeaderboard(userId);
    leaderboard
      .then((results) => {
        if (results.length > 0) {
          res.status(200).send(results);
        } else {
          const { getUserLaborData } = dashboardhelper;
          getUserLaborData(userId).then((r) => {
            res.status(200).send(r);
          });
        }
      })
      .catch((error) => res.status(400).send(error));
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
        <p>Severity/Priority (How Bad is the Bug?</p>
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

  const getSuggestionFilePath = async () => {
    // Define a base path based on the process.cwd()
    const basePath = process.cwd();
    console.log(basePath, "basePath");

    // Define the relative path to the JSON file (adjust as needed)
    const relativePath = "src/constants/suggestionModalData.json";

    // Combine the base path and relative path to create the full path
    const fullPath = path.join(basePath, relativePath);

    return fullPath;
  };

  const readSuggestionFile = async () => {
    // Specify the absolute path to the JSON file
    const filepath = await getSuggestionFilePath();

    try {
      // Check if the file exists
      await fs.access(filepath);

      // Read and parse the file
      const readfile = await fs.readFile(filepath, "utf8");
      const parsedData = JSON.parse(readfile);
      return parsedData;
    } catch (err) {
      console.error("Error reading suggestionModalData.json:", err);
      return null; // Handle the error appropriately
    }
  };

  // create suggestion emailbody
  const getsuggestionEmailBody = async (...args) => {
    const readfile = await readSuggestionFile();
    let fieldaaray = [];
    if (readfile.field.length) {
      fieldaaray = readfile.field.map(
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
      const readfile = await readSuggestionFile();
      if (readfile) {
        res.status(200).send(readfile);
      } else {
        res.status(404).send("Suggestion file not found.");
      }
    } catch (error) {
      console.error("Error reading suggestion file:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  // add new suggestion category or field
  const editSuggestionOption = async (req, res) => {
    try {
      // Read the current suggestion data
      let readfile = await readSuggestionFile();

      if (req.body.suggestion) {
        if (req.body.action === "add") {
          readfile.suggestion.unshift(req.body.newField);
        }
        if (req.body.action === "delete") {
          readfile = {
            ...readfile,
            suggestion: readfile.suggestion.filter(
              (item, index) => index + 1 !== +req.body.newField
            ),
          };
        }
      } else {
        if (req.body.action === "add") {
          readfile.field.unshift(req.body.newField);
        }
        if (req.body.action === "delete") {
          readfile = {
            ...readfile,
            field: readfile.field.filter((item) => item !== req.body.newField),
          };
        }
      }

      // Get the file path
      const filepath = await getSuggestionFilePath();

      // Write the updated data back to the file
      await fs.writeFile(filepath, JSON.stringify(readfile, null, 2));

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
  };
};

module.exports = dashboardcontroller;
