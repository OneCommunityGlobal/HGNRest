/* eslint-disable consistent-return */
const mongoose = require('mongoose');
const reporthelperClosure = require('../helpers/reporthelper');
const overviewReportHelperClosure = require('../helpers/overviewReportHelper');
const { hasPermission } = require('../utilities/permissions');
const UserProfile = require('../models/userProfile');

const reportsController = function () {
  const overviewReportHelper = overviewReportHelperClosure();
  const reporthelper = reporthelperClosure();

  /**
   * Aggregates the trend data for volunteer count
   * Parameters:
   * timeFrame - 0, 1, 2, etc: 0 represents all time
   * offset - *STRING* week/month
   * customStartDate / customEndDate - *DATE STRING as "YYYY-MM-DD" || NULL* custom date ranges, overrides timeFrame parameter
   */
  const getVolunteerTrends = async (req, res) => {
    const { timeFrame, offset, customStartDate, customEndDate } = req.query;

    if (!timeFrame || !offset) {
      return res.status(400).send({ msg: 'Please provide a timeframe and offset' });
    }

    if (![0, 1, 2, 3, 5, 10].includes(+timeFrame)) {
      return res.status(400).send({ msg: 'Invalid timeFrame' });
    }

    if (!['week', 'month'].includes(offset)) {
      return res.status(400).send({ msg: 'Offset param must either be `week` or `month`' });
    }

    try {
      const data = await overviewReportHelper.getVolunteerTrends(
        timeFrame,
        offset,
        customStartDate,
        customEndDate,
      );
      res.status(200).send(data);
    } catch (err) {
      res.status(400).send(err);
    }
  };

  /**
   * Aggregates all the data needed for the volunteer stats page
   * # Active volunteers
   * # New volunteers
   * # Deactivated volunteers
   * # Badges awarded
   * Location data aggregation
   * Weekly anniversaries
   * Blue square stats
   * In teams stats
   */
  const getVolunteerStatsData = async (req, res) => {
    const { startDate, endDate, comparisonStartDate, comparisonEndDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).send({ msg: 'Please provide a start and end date' });
    }

    let isoComparisonStartDate;
    let isoComparisonEndDate;

    if (comparisonStartDate && comparisonEndDate) {
      isoComparisonStartDate = new Date(comparisonStartDate);
      isoComparisonEndDate = new Date(comparisonEndDate);
    }

    const isoStartDate = new Date(startDate);
    const isoEndDate = new Date(endDate);

    try {
      const [
        volunteerNumberStats,
        volunteerHoursStats,
        totalHoursWorked,
        tasksStats,
        workDistributionStats,
        roleDistributionStats,
        usersInTeamStats,
        blueSquareStats,
        anniversaryStats,
        totalBadgesAwarded,
        totalActiveTeams,
        userLocations,
        completedHours,
        taskAndProjectStats,
        volunteersOverAssignedTime,
        completedAssignedHours,
        totalSummariesSubmitted,
      ] = await Promise.all([
        overviewReportHelper.getVolunteerNumberStats(
          isoStartDate,
          isoEndDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
        overviewReportHelper.getHoursStats(
          isoStartDate,
          isoEndDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
        overviewReportHelper.getTotalHoursWorked(
          isoStartDate,
          isoEndDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
        overviewReportHelper.getTasksStats(
          isoStartDate,
          isoEndDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
        overviewReportHelper.getWorkDistributionStats(
          isoStartDate,
          isoEndDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
        overviewReportHelper.getRoleDistributionStats(),
        overviewReportHelper.getTeamMembersCount(isoEndDate, isoComparisonEndDate),
        overviewReportHelper.getBlueSquareStats(
          isoStartDate,
          isoEndDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
        overviewReportHelper.getAnniversaries(
          isoStartDate,
          isoEndDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
        overviewReportHelper.getTotalBadgesAwardedCount(
          startDate,
          endDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
        overviewReportHelper.getTotalActiveTeamCount(isoEndDate, isoComparisonEndDate),
        overviewReportHelper.getMapLocations(),
        overviewReportHelper.getVolunteersCompletedHours(
          isoStartDate,
          isoEndDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
        overviewReportHelper.getTaskAndProjectStats(
          startDate,
          endDate,
          comparisonStartDate,
          comparisonEndDate,
        ),
        overviewReportHelper.getVolunteersOverAssignedTime(isoStartDate, isoEndDate),
        overviewReportHelper.getVolunteersCompletedAssignedHours(
          isoStartDate,
          isoEndDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
        overviewReportHelper.getTotalSummariesSubmitted(
          isoStartDate,
          isoEndDate,
          isoComparisonStartDate,
          isoComparisonEndDate,
        ),
      ]);
      res.status(200).send({
        volunteerNumberStats,
        volunteerHoursStats,
        totalHoursWorked,
        tasksStats,
        workDistributionStats,
        roleDistributionStats,
        usersInTeamStats,
        blueSquareStats,
        anniversaryStats,
        totalBadgesAwarded,
        totalActiveTeams,
        userLocations,
        completedHours,
        taskAndProjectStats,
        volunteersOverAssignedTime,
        completedAssignedHours,
        totalSummariesSubmitted,
      });
    } catch (err) {
      console.log(err);
      res.status(500).send({ msg: 'Error occured while fetching data. Please try again!' });
    }
  };

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
   * 4. Number of members in team and not in team, with percentage
   * 5. Number of active and inactive users
   *
   * @param {*} req  params: startDate, endDate (e.g. 2024-01-14, 2024-01-21)
   * @param {*} res
   */
  const getVolunteerStats = async function (req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).send('Please provide startDate and endDate');
        return;
      }

      // 1. 4+ members team count
      const fourPlusMembersTeamCount = await overviewReportHelper.getFourPlusMembersTeamCount();

      // 2. Total badges awarded count
      const badgeCountQuery = await overviewReportHelper.getTotalBadgesAwardedCount(
        startDate,
        endDate,
      );
      const badgeAwardedCount = badgeCountQuery.length > 0 ? badgeCountQuery[0].badgeCollection : 0;

      // 3. Number of users celebrating their anniversary
      const anniversaryCountQuery = await overviewReportHelper.getAnniversaryCount(
        startDate,
        endDate,
      );
      const anniversaryCount =
        anniversaryCountQuery.length > 0 ? anniversaryCountQuery[0].anniversaryCount : 0;

      // 4. Number of members in team and not in team, with percentage
      const teamMembersCount = await overviewReportHelper.getTeamMembersCount();

      // 5. Number of active and inactive users
      const activeInactiveUsersCount = await overviewReportHelper.getActiveInactiveUsersCount();

      const volunteerStats = {
        fourPlusMembersTeamCount,
        badgeAwardedCount,
        anniversaryCount,
        teamMembersCount,
        activeInactiveUsersCount,
      };

      res.status(200).json(volunteerStats);
    } catch (error) {
      res.status(404).send(error);
    }
  };

  /**
   * Gets the Volunteer Hours Stats, it groups the users based on the number of hours they have logged
   * Every ten hours is a group, so 0-9 hours, 10-19 hours, 20-29 hours, and finally 60+ hours
   * It also groups users based off the percentage of their weeklycommittedHours worked for the current and previous week.
   * @param {*} req  params: startDate, endDate (e.g. 2024-01-14, 2024-01-21)
   * @param {*} res
   */
  const getVolunteerHoursStats = async function (req, res) {
    try {
      const { startDate, endDate, lastWeekStartDate, lastWeekEndDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).send('Please provide startDate and endDate');
        return;
      }

      const volunteerHoursStats = await overviewReportHelper.getVolunteerHoursStats(
        startDate,
        endDate,
        lastWeekStartDate,
        lastWeekEndDate,
      );
      res.status(200).json(volunteerHoursStats);
    } catch (error) {
      console.log(error);
      res.status(404).send(error);
    }
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
      const fourPlusMembersTeamCount = await overviewReportHelper.getFourPlusMembersTeamCount();

      // 2. Total badges awarded count
      const badgeCountQuery = await overviewReportHelper.getTotalBadgesAwardedCount(
        startDate,
        endDate,
      );
      const badgeAwardedCount = badgeCountQuery.length > 0 ? badgeCountQuery[0].badgeCollection : 0;

      // 3. Number of users celebrating their anniversary
      const anniversaryCountQuery = await overviewReportHelper.getAnniversaryCount(
        startDate,
        endDate,
      );
      const anniversaryCount =
        anniversaryCountQuery.length > 0 ? anniversaryCountQuery[0].anniversaryCount : 0;

      // 4. role and count of users
      const roleQuery = await overviewReportHelper.getRoleCount();

      const roles = roleQuery.map((role) => ({
        role: role._id,
        count: role.count,
      }));

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
  };

  /**
   * Gets the Task and Project Stats, it contains
   * 1. Total hours logged in tasks
   * 2. Total hours logged in projects
   * 3. Number of member with tasks assigned
   * 4. Number of member without tasks assigned
   * @param {*} req:  params: startDate, endDate (e.g. 2024-01-14, 2024-01-21)
   * @param {*} res
   *
   */
  const getTaskAndProjectStats = async function (req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).send('Please provide startDate and endDate');
        return;
      }

      const taskAndProjectStats = await overviewReportHelper.getTaskAndProjectStats(
        startDate,
        endDate,
      );
      res.status(200).json(taskAndProjectStats);
    } catch (error) {
      res.status(404).send(error);
    }
  };

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

      const blueSquareStats = await overviewReportHelper.getBlueSquareStats(startDate, endDate);
      const blueSquareCount = blueSquareStats.length > 0 ? blueSquareStats[0].infringements : 0;

      res.status(200).json({ msg: { blueSquareCount } });
    } catch (error) {
      res.status(404).send(error);
    }
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

  // eslint-disable-next-line consistent-return
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
          res.status(200).send({ message: 'updated user record with getWeeklyReport true' });
        })
        .catch((err) => {
          console.log('error in catch block last:', err);
          res.status(404).send(err);
        });
    } catch (error) {
      res.status(404).send(error);
    }
  };

  const getTeamsWithActiveMembers = async (req, res) => {
    const { endDate, activeMembersMinimum } = req.query;

    if (!endDate) {
      return res.status(400).send({ msg: 'Please provide an end date' });
    }
    if (!activeMembersMinimum) {
      return res.status(400).send({
        msg: 'Please provide the number of minimum active members in the team (activeMembersMinimum query param)',
      });
    }

    const isoEndDate = new Date(endDate);

    try {
      const teamsWithActiveMembers = await overviewReportHelper.getTeamsWithActiveMembers(
        isoEndDate,
        Number(activeMembersMinimum),
      );
      res.status(200).send({ teamsWithActiveMembers });
    } catch (err) {
      console.log(err);
      res.status(500).send({ msg: 'Error occured while fetching data. Please try again!' });
    }
  };

  return {
    getVolunteerStats,
    getVolunteerHoursStats,
    getTaskAndProjectStats,
    getWeeklySummaries,
    getReportRecipients,
    deleteReportsRecepients,
    saveReportsRecepients,
    getVolunteerRoleStats,
    getBlueSquareStats,
    getVolunteerStatsData,
    getVolunteerTrends,
    getTeamsWithActiveMembers,
  };
};

module.exports = reportsController;
