/* eslint-disable quotes */
const TeamProfile = require('../models/team');
const UserProfile = require('../models/userProfile');

const overviewReportHelper = function () {
  /**
   * 
   * @returns The number of teams with 4 or more members.
   */
  async function getFourPlusMembersTeamCount () {
    // check if members array has 4 or more members
    return TeamProfile.countDocuments({ 'members.4': { $exists: true } });
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

  return {
    getFourPlusMembersTeamCount,
    getTotalBadgesAwardedCount,
    getAnniversaryCount,
    getRoleCount,
    getBlueSquareStats,
  };
};

module.exports = overviewReportHelper;
