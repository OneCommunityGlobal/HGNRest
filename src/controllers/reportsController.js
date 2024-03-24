const mongoose = require('mongoose');
const reporthelper = require('../helpers/reporthelper')();
const { hasPermission } = require('../utilities/permissions');
const UserProfile = require('../models/userProfile');
const TeamProfile = require('../models/team');
const userhelper = require('../helpers/userHelper')();

const reportsController = function () {
  const getWeeklySummaries = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'getWeeklySummaries'))) {
      res.status(403).send('You are not authorized to view all users');
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
   * Gets the Volunteer Role Stats, it contains
   * 1. 4+ members team count
   * 2. Total badges awarded count
   * 3. Number of users celebrating their anniversary
   * 4. role and count of users
   * 
   * @param {*} req  params: startDate, endDate (e.g. 2024-01-14, 2024-01-21)
   * @param {*} res 
   */
  const getVolunteerRoleStats = async function (req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).send('Please provide startDate and endDate');
        return;
      }

      // 1. 4+ members team count
      const fourPlusMembersTeamCount = await TeamProfile.countDocuments({
        'members.4': { $exists: true },
      });

      // 2. Total badges awarded count
      const badgeCountQuery = await UserProfile.aggregate([
        {
          $unwind: '$badgeCollection',
        },
        {
          $match: {
            'badgeCollection.earnedDate': {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $count: 'badgeCollection',
        },
      ]);
      
      const badgeAwardedCount = badgeCountQuery.length > 0 ? badgeCountQuery[0].badgeCollection : 0;

      // 3. Number of users celebrating their anniversary
      const anniversaryCountQuery = await UserProfile.aggregate([
        {
          $addFields: {
            createdMonthDay: { $dateToString: { format: "%m-%d", date: "$createdDate" } }
          }
        },
        {
          $match: {
            createdMonthDay: {
              $gte: new Date(startDate).toISOString().substring(5, 10),
              $lte: new Date(endDate).toISOString().substring(5, 10),
            },
          },
        },
        {
          $count: 'anniversaryCount',
        },
      ]);

      const anniversaryCount = anniversaryCountQuery.length > 0 ? anniversaryCountQuery[0].anniversaryCount : 0;

      // 4. role and count of users
      const roleQuery = await UserProfile.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
          },
        },
      ]);

      const roles = roleQuery.map((role) => {
        return {
          role: role._id,
          count: role.count,
        };
      });

      const volunteerRoleStats = {
        fourPlusMembersTeamCount,
        badgeAwardedCount,
        anniversaryCount,
        roles,
      };

      res.status(200).json(volunteerRoleStats);
    } catch (error) {
      res.status(404).send(error);
    }
  }

  /**
   * Gets the Task and Project Stats
   * @param {*} req:  params: startDate, endDate (e.g. 2024-01-14, 2024-01-21)
   * @param {*} res
   * 
  */
  const getTaskAndProjectStats = async function (req, res) {
  }

  /**
   * Gets the Blue Square Stats, it filters the data based on the startDate and endDate
   * @param {*} req: params: startDate, endDate (e.g. 2024-01-14, 2024-01-21)
   * @param {*} res 
   * @todo: Currently, infrigements do not contain a type field, so we are unable to group by type and count the number of infringements.
   */
  const getBlueSquareStats = async function (req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).send('Please provide startDate and endDate');
        return;
      }

      // UserProfile has a field called "infringements", which is an array of objects that has date and description fields.
      // The date field is a string, and the description field is a string.
      // count the number of infringements that fall between the startDate and endDate
      const blueSquareStats = await UserProfile.aggregate([
        {
          $unwind: '$infringements',
        },
        {
          $match: {
            'infringements.date': {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $count: 'infringements',
        },
      ]);
      
      const blueSquareCount = blueSquareStats.length > 0 ? blueSquareStats[0].infringements : 0;

      res.status(200).json({"msg": {blueSquareCount}});
    } catch (error) {
      res.status(404).send(error);
    }
  }

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
          permissionGrantedToGetWeeklySummaryReport: 1,
        },
      )
        .then((results) => {
          res.status(200).send(results);
        })
        .catch((error) => {
          console.log('error:', error); // need to delete later *
          res.status(404).send({ error });
        });
    } catch (err) {
      console.log('error:', err); // need to delete later *
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
            res.status(404).send('No valid records found');
            return;
          }
          res.status(200).send({
            message: 'updated user record with getWeeklyReport false',
          });
        })
        .catch((err) => {
          console.log('error in catch block last:', err);
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

      UserProfile.updateOne(
        { _id: id },
        {
          $set: {
            getWeeklyReport: true,
            permissionGrantedToGetWeeklySummaryReport: Date.now(), // The date when the user was granted permission to receive the summary report will be updated and shown
          },
        },
      )
        .then((record) => {
          if (!record) {
            console.log("'No valid records found'");
            res.status(404).send('No valid records found');
            return;
          }
          res
            .status(200)
            .send({ message: 'updated user record with getWeeklyReport true' });
        })
        .catch((err) => {
          console.log('error in catch block last:', err);
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
    getVolunteerRoleStats,
    getBlueSquareStats,
  };
};

module.exports = reportsController;
