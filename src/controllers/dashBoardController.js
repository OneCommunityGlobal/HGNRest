import userProfile from 'models/userProfile';
import { showTrophyIcon } from 'utilities/trophyPermissions';
import moment from 'moment';
import actionItem from 'models/actionItem';

const mongoose = require('mongoose');
const dashboardhelper = require('../helpers/dashboardhelper')();
const emailSender = require('../utilities/emailSender');

const dashboardcontroller = function () {
  const dashboarddata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);

    const snapshot = dashboardhelper.personaldetails(userId);

    snapshot.then((results) => { res.send(results).status(200); });
  };

  const monthlydata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const laborthismonth = dashboardhelper.laborthismonth(userId, req.params.fromDate, req.params.toDate);
    laborthismonth.then((results) => {
      if (!results || results.length === 0) {
        const emptyresult = [{
          projectName: '',
          timeSpent_hrs: 0,
        }];
        res.status(200).send(emptyresult);
        return;
      }
      res.status(200).send(results);
    });
  };

  const weeklydata = function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const laborthisweek = dashboardhelper.laborthisweek(userId, req.params.fromDate, req.params.toDate);
    laborthisweek.then((results) => { res.send(results).status(200); });
  };


  const leaderboarddata = function (req, res) {
    const todaysDate = moment().tz('America/Los_Angeles').format('YYYY-MM-DD');
    const userId = mongoose.Types.ObjectId(req.params.userId);
    const leaderboard = dashboardhelper.getLeaderboard(userId);
    leaderboard.then((results) => {
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
        `Bug Rport from ${firstName} ${lastName}`,
        emailBody,
        email,
      );
      res.status(200).send('Success');
    } catch {
      res.status(500).send('Failed');
    }
  };


  return {
    dashboarddata,
    monthlydata,
    weeklydata,
    leaderboarddata,
    postTrophyIcon,
    orgData,
    sendBugReport,
  };
};

module.exports = dashboardcontroller;
