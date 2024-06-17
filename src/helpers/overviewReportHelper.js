/* eslint-disable no-plusplus */
/* eslint-disable quotes */
const Team = require('../models/team');
const UserProfile = require('../models/userProfile');
const TimeEntries = require('../models/timeentry');
const Task = require('../models/task');

const overviewReportHelper = function () {
  /**
   * aggregates the total number of hours worked between the 5 categories
   * Food, Energy, Housing, Stewardship, Society, Economics and Other
   */
  async function getWorkDistributionStats(startDate, endDate) {
    const distributionStats = TimeEntries.aggregate([
      {
        $match: {
          dateOfWork: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project',
        },
      },
      {
        $unwind: {
          path: '$project',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '#project.category',
          aggregatedSeconds: { $sum: '$totalSeconds' },
        },
      },
      {
        $project: {
          _id: 1,
          totalHours: { $divide: ['$aggregatedSeconds', 3600] },
        },
      },
    ]);

    return distributionStats;
  }

  async function getTasksStats(startDate, endDate) {
    const taskStats = await Task.aggregate([
      {
        $match: {
          modifiedDatetime: { $gte: startDate, $lte: endDate },
          status: { $in: ['Complete', 'Active'] },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    if (!taskStats.find((x) => x._id === 'Active')) {
      taskStats.push({ _id: 'Active', count: 0 });
    }
    if (!taskStats.find((x) => x._id === 'Complete')) {
      taskStats.push({ _id: 'Complete', count: 0 });
    }

    return taskStats;
  }
  /**
   * Get the volunteer hours stats, it retrieves the number of hours logged by users between the two input dates as well as their weeklycommittedHours.
   * @param {*} startDate
   * @param {*} endDate
   */
  async function getHoursStats(startDate, endDate) {
    const hoursStats = await UserProfile.aggregate([
      {
        $match: {
          isActive: true,
        },
      },
      {
        $lookup: {
          from: 'timeEntries', // The collection to join
          localField: '_id', // Field from the userProfile collection
          foreignField: 'personId', // Field from the timeEntries collection
          as: 'timeEntries', // The array field that will contain the joined documents
        },
      },
      {
        $unwind: {
          path: '$timeEntries',
          preserveNullAndEmptyArrays: true, // Preserve users with no time entries
        },
      },
      {
        $match: {
          $or: [
            { timeEntries: { $exists: false } },
            { 'timeEntries.dateOfWork': { $gte: startDate, $lte: endDate } },
          ],
        },
      },
      {
        $group: {
          _id: '$_id',
          personId: { $first: '$_id' },
          totalSeconds: { $sum: '$timeEntries.totalSeconds' }, // Sum seconds from timeEntries
          weeklycommittedHours: { $first: `$weeklycommittedHours` }, // Include the weeklycommittedHours field
        },
      },
      {
        $project: {
          totalHours: { $divide: ['$totalSeconds', 3600] }, // Convert seconds to hours
          weeklycommittedHours: 1, // make sure we include it in the end result
        },
      },
      {
        $bucket: {
          groupBy: '$totalHours',
          boundaries: [0, 10, 20, 30, 40],
          default: 40,
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ]);
    for (let i = 0; i < 5; i++) {
      if (!hoursStats.find((x) => x._id === i * 10)) {
        hoursStats.push({ _id: i * 10, count: 0 });
      }
    }
    return hoursStats;
  }

  /**
   * Aggregates total number of hours worked across all volunteers within the specified date range
   */
  async function getTotalHoursWorked(startDate, endDate) {
    console.log(startDate, endDate);
    const data = await TimeEntries.aggregate([
      {
        $match: {
          dateOfWork: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: '$totalSeconds' },
        },
      },
      {
        $project: {
          _id: 0,
          totalHours: { $divide: ['$totalSeconds', 3600] },
        },
      },
    ]);

    return data;
  }

  /**
   * returns the number of:
   * 1. Active volunteers
   * 2. Volunteers that deactivated in the current week
   * 3. New volunteers in the current week
   *
   * @param {string} startDate
   * @param {string} endDate
   */
  const getVolunteerNumberStats = async (startDate, endDate) => {
    const data = await UserProfile.aggregate([
      {
        $facet: {
          activeVolunteers: [{ $match: { isActive: true } }, { $count: 'activeVolunteersCount' }],

          newVolunteers: [
            {
              $match: {
                createdDate: {
                  $gte: startDate,
                  $lte: endDate,
                },
              },
            },
            { $count: 'newVolunteersCount' },
          ],

          deactivatedVolunteers: [
            {
              $match: {
                $and: [
                  { lastModifiedDate: { $gte: startDate } },
                  { lastModifiedDate: { $lte: endDate } },
                  { isActive: false },
                ],
              },
            },
            { $count: 'deactivedVolunteersCount' },
          ],
        },
      },
    ]);

    return data;
  };

  /**
   *
   * @returns The number of teams with 4 or more members.
   */
  async function getFourPlusMembersTeamCount() {
    // check if members array has 4 or more members
    return Team.countDocuments({ 'members.4': { $exists: true } });
  }

  /**
   * Get the total number of badges awarded between the two input dates.
   * @param {*} startDate
   * @param {*} endDate
   * @returns The total number of badges awarded between the two input dates.
   */
  async function getTotalBadgesAwardedCount(startDate, endDate) {
    return UserProfile.aggregate([
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
  }

  /**
   *  Get the number of users celebrating their anniversary between the two input dates.
   * @param {*} startDate
   * @param {*} endDate
   * @returns  The number of users celebrating their anniversary between the two input dates.
   */
  async function getAnniversaryCount(startDate, endDate) {
    return UserProfile.aggregate([
      {
        $addFields: {
          createdMonthDay: { $dateToString: { format: '%m-%d', date: '$createdDate' } },
        },
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
  }

  /**
   * Get the role and count of users.
   * @returns The role and count of users.
   */
  async function getRoleCount() {
    return UserProfile.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);
  }

  /**
   * Get the number of Blue Square infringements between the two input dates.
   * @param {*} startDate
   * @param {*} endDate
   * @returns
   */
  async function getBlueSquareStats(startDate, endDate) {
    return UserProfile.aggregate([
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
  }

  /**
   *  Get the number of members in team and not in team, with percentage
   */
  async function getTeamMembersCount() {
    const totalUsers = await UserProfile.countDocuments();
    const usersInTeam = await UserProfile.aggregate([
      {
        $match: {
          teams: { $exists: true, $ne: [] },
        },
      },
      {
        $count: 'usersInTeam',
      },
    ]);
    const usersNotInTeam = totalUsers - usersInTeam[0].usersInTeam;
    const usersInTeamPercentage = ((usersInTeam[0].usersInTeam / totalUsers) * 100).toFixed(2);
    const usersNotInTeamPercentage = ((usersNotInTeam / totalUsers) * 100).toFixed(2);

    return {
      usersInTeam: usersInTeam[0].usersInTeam,
      usersNotInTeam,
      usersInTeamPercentage,
      usersNotInTeamPercentage,
    };
  }

  /**
   * Get the number of active and inactive users.
   */
  async function getActiveInactiveUsersCount() {
    const activeUsers = await UserProfile.countDocuments({ isActive: true });
    const inactiveUsers = await UserProfile.countDocuments({ isActive: false });

    return {
      activeUsers,
      inactiveUsers,
    };
  }

  /**
   * Groups users based off of hours logged and the percentage of hours logged divided by their weeklycommittedHours for the current week and last week.
   * @param {*} startDate
   * @param {*} endDate
   */
  async function getVolunteerHoursStats(startDate, endDate, lastWeekStartDate, lastWeekEndDate) {
    const currentWeekStats = await getHoursStats(startDate, endDate);
    const lastWeekStats = await getHoursStats(lastWeekStartDate, lastWeekEndDate);

    const volunteerHoursStats = {
      numberOfUsers: currentWeekStats.length,
    };

    //
    const percentageWorkedStats = {
      thisWeek: { '<100': 0, '100-109': 0, '110-149': 0, '150-199': 0, '200+': 0 },
      lastWeek: { '<100': 0, '100-109': 0, '110-149': 0, '150-199': 0, '200+': 0 },
    };

    for (let i = 0; i < 6; i++) {
      const group = i * 10;
      volunteerHoursStats[`${group}-${group + 9}`] = 0;
    }
    volunteerHoursStats['60+'] = 0;

    // Group users by the number of hours logged as well as percentage of weeklycommittedHours worked
    currentWeekStats.forEach((user) => {
      if (user.totalHours >= 60) {
        volunteerHoursStats['60+'] = volunteerHoursStats['60+']
          ? volunteerHoursStats['60+'] + 1
          : 1;
        console.log('user with 60+ hours');
      } else {
        const group = Math.floor(user.totalHours / 10) * 10;
        volunteerHoursStats[`${group}-${group + 9}`] += 1;
      }

      const percentage = user.totalHours / user.weeklycommittedHours;

      if (percentage < 1) {
        percentageWorkedStats.thisWeek['<100'] += 1;
      } else if (percentage < 1.1) {
        percentageWorkedStats.thisWeek['100-109'] += 1;
      } else if (percentage < 1.5) {
        percentageWorkedStats.thisWeek['110-149'] += 1;
      } else if (percentage < 2) {
        percentageWorkedStats.thisWeek['150-199'] += 1;
      } else {
        percentageWorkedStats.thisWeek['200+'] += 1;
      }
    });

    // now we need to group last weeks statistics by percentage of weeklycommittedHours worked
    lastWeekStats.forEach((user) => {
      const percentage = user.totalHours / user.weeklycommittedHours;
      if (percentage < 1) {
        percentageWorkedStats.lastWeek['<100'] += 1;
      } else if (percentage < 1.1) {
        percentageWorkedStats.lastWeek['100-109'] += 1;
      } else if (percentage < 1.5) {
        percentageWorkedStats.lastWeek['110-149'] += 1;
      } else if (percentage < 2) {
        percentageWorkedStats.lastWeek['150-199'] += 1;
      } else {
        percentageWorkedStats.lastWeek['200+'] += 1;
      }
    });

    return { volunteerHoursStats, percentageWorkedStats };
  }

  /**
   * 1. Total hours logged in tasks
   * 2. Total hours logged in projects
   * 3. Number of member with tasks assigned
   * 4. Number of member without tasks assigned
   * 5. Number of tasks with due date within the date range
   * @param {*} startDate
   * @param {*} endDate
   */
  async function getTaskAndProjectStats(startDate, endDate) {
    // 1. Total hours logged in tasks
    const taskHours = await TimeEntries.aggregate([
      {
        $match: {
          dateOfWork: { $gte: startDate, $lte: endDate },
          taskId: { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: '$totalSeconds' },
        },
      },
      {
        $project: {
          totalHours: { $divide: ['$totalSeconds', 3600] },
        },
      },
    ]);

    // 2. Total hours logged in projects
    const projectHours = await TimeEntries.aggregate([
      {
        $match: {
          dateOfWork: { $gte: startDate, $lte: endDate },
          projectId: { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: '$totalSeconds' },
        },
      },
      {
        $project: {
          totalHours: { $divide: ['$totalSeconds', 3600] },
        },
      },
    ]);

    // 3. Number of member with tasks assigned
    const membersWithTasks = await Task.distinct('resources.userID', {
      'resources.userID': { $exists: true },
      completedTask: { $ne: true },
    });

    // 4. Number of member without tasks assigned
    const membersWithoutTasks = await UserProfile.countDocuments({
      _id: { $nin: membersWithTasks },
    });

    // 5. Number of tasks with due date within the date range
    const tasksDueWithinDate = await Task.countDocuments({
      dueDatetime: { $gte: startDate, $lte: endDate },
    });

    const taskAndProjectStats = {
      taskHours: taskHours[0].totalHours.toFixed(2),
      projectHours: projectHours[0].totalHours.toFixed(2),
      membersWithTasks: membersWithTasks.length,
      membersWithoutTasks,
      tasksDueThisWeek: tasksDueWithinDate,
    };

    return taskAndProjectStats;
  }

  return {
    getVolunteerNumberStats,
    getTasksStats,
    getWorkDistributionStats,
    getTotalHoursWorked,
    getHoursStats,
    getFourPlusMembersTeamCount,
    getTotalBadgesAwardedCount,
    getAnniversaryCount,
    getRoleCount,
    getBlueSquareStats,
    getTeamMembersCount,
    getActiveInactiveUsersCount,
    getVolunteerHoursStats,
    getTaskAndProjectStats,
  };
};

module.exports = overviewReportHelper;
