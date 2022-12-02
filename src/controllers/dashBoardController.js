const mongoose = require('mongoose');
const dashboardHelper = require('../helpers/dashBoardHelper')();
const emailSender = require('../utilities/emailSender');

const dashboardController = function () {
  const dashboardData = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);

    const snapshot = dashboardHelper.personalDetails(userId);

    snapshot.then((results) => { res.send(results).status(200); });
  };

  const monthlyData = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const laborThisMonth = dashboardHelper.laborThisMonth(userId, req.params.fromDate, req.params.toDate);
    laborThisMonth.then((results) => {
      if (!results || results.length === 0) {
        const emptyResult = [{
          projectName: '',
          timeSpent_hrs: 0,
        }];
        res.status(200).send(emptyResult);
        return;
      }
      res.status(200).send(results);
    });
  };

  const weeklyData = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const laborThisWeek = dashboardHelper.laborThisWeek(userId, req.params.fromDate, req.params.toDate);
    laborThisWeek.then((results) => { res.send(results).status(200); });
  };


  const leaderBoardData = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const leaderBoard = dashboardHelper.getLeaderBoard(userId);
    leaderBoard.then((results) => {
      if (results.length > 0) {
        res.status(200).send(results);
      } else {
        const { getUserLaborData } = dashboardHelper;
        getUserLaborData(userId).then((r) => {
          res.status(200).send(r);
        });
      }
    })
      .catch(error => res.status(400).send(error));
  };

  const orgData = function (req, res) {
    const fullOrgData = dashboardHelper.getOrgData();

    fullOrgData.then((results) => { res.status(200).send(results[0]); })
      .catch(error => res.status(400).send(error));
  };

  const getBugReportEmailBody = function (firstName, lastName, title, environment, reproduction, expected, actual, visual, severity) {
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
      firstName, lastName, title, environment, reproduction, expected, actual, visual, severity, email,
    } = req.body;
    const emailBody = getBugReportEmailBody(firstName, lastName, title, environment, reproduction, expected, actual, visual, severity);

    try {
      emailSender(
        'onecommunityglobal@gmail.com',
        `Bug Report from ${firstName} ${lastName}`,
        emailBody,
        email,
      );
      res.status(200).send('Success');
    } catch {
      res.status(500).send('Failed');
    }
  };


  return {
    dashboardData,
    monthlyData,
    weeklyData,
    leaderBoardData,
    orgData,
    sendBugReport,
  };
};

module.exports = dashboardController;
