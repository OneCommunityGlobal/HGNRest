/* eslint-disable quotes */
const Team = require('../models/team');
const UserProfile = require('../models/userProfile');
const timeEntries = require('../models/timeentry');

const overviewReportHelper = function () {
  /**
   * 
   * @returns The number of teams with 4 or more members.
   */
  async function getFourPlusMembersTeamCount () {
    // check if members array has 4 or more members
    return Team.countDocuments({ 'members.4': { $exists: true } });
  }


  /**
   * Get the total number of badges awarded between the two input dates.
   * @param {*} startDate 
   * @param {*} endDate 
   * @returns The total number of badges awarded between the two input dates.
   */
  async function getTotalBadgesAwardedCount (startDate, endDate) {
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
  async function getAnniversaryCount (startDate, endDate) {
    return UserProfile.aggregate([
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
  }

  /**
   * Get the role and count of users.
   * @returns The role and count of users.
   */
  async function getRoleCount () {
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
  async function getBlueSquareStats (startDate, endDate) {
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


  return {
    getFourPlusMembersTeamCount,
    getTotalBadgesAwardedCount,
    getAnniversaryCount,
    getRoleCount,
    getBlueSquareStats,
    getTeamMembersCount,
    getActiveInactiveUsersCount,
  };
};

module.exports = overviewReportHelper;
