/* eslint-disable no-plusplus */
/* eslint-disable quotes */
const Team = require('../models/team');
const UserProfile = require('../models/userProfile');
// const timeEntries = require('../models/timeentry');

const overviewReportHelper = function () {
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
   * Get the volunteer hours stats, it retrieves the number of hours logged by users between the two input dates.
   * @param {*} startDate
   * @param {*} endDate
   */
  async function getVolunteerHoursStats(startDate, endDate) {
    const hoursStats = await UserProfile.aggregate([
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
          // Adjust this condition to include all users, filtering timeEntries by date
          $or: [
            { 'timeEntries.dateOfWork': { $gte: startDate, $lte: endDate } },
            { timeEntries: { $exists: false } },
          ],
        },
      },
      {
        $group: {
          _id: '$_id',
          personId: { $first: '$_id' },
          totalSeconds: { $sum: '$timeEntries.totalSeconds' }, // Sum seconds from timeEntries
        },
      },
      {
        $project: {
          totalHours: { $divide: ['$totalSeconds', 3600] }, // Convert seconds to hours
        },
      },
    ]);

    const volunteerHoursStats = {
      numberOfUsers: hoursStats.length,
    };

    // we cannot start the loop at 0 or else the parameters inside the volunteerHourStats will be off by a multiple of 10
    // or if we want to account for those that did not meet minimum, we can increase the range from 6 to 7
    for (let i = 0; i < 7; i++) {
      const group = i * 10;
      volunteerHoursStats[`${group}-${group + 9}`] = 0;
    }

    // Group users by the number of hours logged
    hoursStats.forEach((user) => {
      if (user.totalHours >= 60) {
        volunteerHoursStats['60+'] = volunteerHoursStats['60+']
          ? volunteerHoursStats['60+'] + 1
          : 1;
      } else {
        const group = Math.floor(user.totalHours / 10) * 10;
        volunteerHoursStats[`${group}-${group + 9}`] += 1;
      }
    });

    return volunteerHoursStats;
  }

  return {
    getFourPlusMembersTeamCount,
    getTotalBadgesAwardedCount,
    getAnniversaryCount,
    getRoleCount,
    getBlueSquareStats,
    getTeamMembersCount,
    getActiveInactiveUsersCount,
    getVolunteerHoursStats,
  };
};

module.exports = overviewReportHelper;
