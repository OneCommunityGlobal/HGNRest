/* eslint-disable no-plusplus */
/* eslint-disable quotes */
/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
const moment = require('moment');
const Team = require('../models/team');
const UserProfile = require('../models/userProfile');
const TimeEntries = require('../models/timeentry');
const Task = require('../models/task');
const Project = require('../models/project');

function calculateGrowthPercentage(current, prev) {
  // Handles undefined cases
  if (prev === undefined || prev === null || prev === 0) {
    return current === 0 ? 0 : 'No Comparison Data';
  }

  const percentage = (current - prev) / prev;
  return Math.round(percentage * 100) / 100;
}

const overviewReportHelper = function () {
  /*
   * Get volunteers completed assigned hours.
   * aggregates the number of volunteers who met their weekly committed hours in the time periods provided
   */
  async function getVolunteersCompletedHours(
    startDate,
    endDate,
    comparisonStartDate,
    comparisonEndDate,
  ) {
    if (comparisonStartDate && comparisonEndDate) {
      const hoursStats = await UserProfile.aggregate([
        {
          $facet: {
            current: [
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
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $match: {
                  $or: [
                    { timeEntries: { $exists: false } },
                    {
                      'timeEntries.dateOfWork': {
                        $gte: moment(startDate).format('YYYY-MM-DD'),
                        $lte: moment(endDate).format('YYYY-MM-DD'),
                      },
                    },
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
                $project: {
                  metCommitment: { $gte: ['$totalHours', '$weeklycommittedHours'] },
                },
              },
              {
                $match: {
                  metCommitment: true,
                },
              },
              {
                $count: 'metCommitment',
              },
            ],

            comparison: [
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
                  preserveNullAndEmptyArrays: false,
                },
              },
              {
                $match: {
                  $or: [
                    // { timeEntries: { $exists: false } },
                    {
                      'timeEntries.dateOfWork': {
                        $gte: moment(startDate).format('YYYY-MM-DD'),
                        $lte: moment(endDate).format('YYYY-MM-DD'),
                      },
                    },
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
                $project: {
                  metCommitment: { $gte: ['$totalHours', '$weeklycommittedHours'] },
                },
              },
              {
                $match: {
                  metCommitment: true,
                },
              },
              {
                $count: 'metCommitment',
              },
            ],
          },
        },
      ]);

      const data = {};
      data.current = hoursStats[0]?.current[0]?.metCommitment || 0;
      data.comparison = hoursStats[0]?.comparison[0]?.metCommitment || 0;
      data.percentage = calculateGrowthPercentage(data.current, data.comparison);

      return data;
    }

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
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $or: [
            { timeEntries: { $exists: false } },
            {
              'timeEntries.dateOfWork': {
                $gte: moment(startDate).format('YYYY-MM-DD'),
                $lte: moment(endDate).format('YYYY-MM-DD'),
              },
            },
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
        $project: {
          metCommitment: { $gte: ['$totalHours', '$weeklycommittedHours'] },
        },
      },
      {
        $match: {
          metCommitment: true,
        },
      },
      {
        $count: 'metCommitment',
      },
    ]);

    const data = {};
    data.current = hoursStats[0]?.metCommitment || 0;
    return data;
  }

  /**
   * Get volunteer trends by time.
   * Gets the total number of volunteer hours worked per month
   * For now it will be aggregated for the past year
   *
   * @param {Number} timeFrame - must be 1, 2, 3, 5, or 10
   * representing the number of years to cover or 0 to represent all-time.
   */
  async function getVolunteerTrends(timeFrame, offset, customStartDate, customEndDate) {
    const currentDate = moment();
    let startDate;
    let endDate;

    if (!customStartDate && !customEndDate) {
      switch (timeFrame) {
        case '0': {
          // 'All-time' option
          // use the date the oldest user was created
          const [oldestVolunteer] = await UserProfile.aggregate([
            {
              $sort: { createdDate: 1 },
            },
            {
              $limit: 1,
            },
            {
              $project: { createdDate: 1 },
            },
          ]);
          startDate = oldestVolunteer.createdDate;
          break;
        }
        case '1':
          // 'This year' option
          startDate = currentDate.clone().startOf('year').toDate();
          break;
        case '2':
          // 'Last 2 years' option
          startDate = currentDate.clone().subtract(2, 'years').startOf('month').toDate();
          break;
        case '3':
          // 'Last 3 years' option
          startDate = currentDate.clone().subtract(3, 'years').startOf('month').toDate();
          break;
        case '5':
          // 'Last 5 years' option
          startDate = currentDate.clone().subtract(5, 'years').startOf('month').toDate();
          break;
        case '10':
          // 'Last 10 years' option
          startDate = currentDate.clone().subtract(10, 'years').startOf('month').toDate();
          break;
        default:
          throw new Error('invalid timeFrame');
      }
      endDate = currentDate.clone().endOf('month').toDate();
    } else {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    }

    let data;
    if (offset === 'week') {
      data = TimeEntries.aggregate([
        {
          $match: {
            createdDateTime: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $project: {
            createdYear: { $year: '$createdDateTime' },
            createdWeek: { $week: '$createdDateTime' },
            totalSeconds: 1,
          },
        },
        {
          $group: {
            _id: {
              year: '$createdYear',
              week: '$createdWeek',
            },
            totalHours: { $sum: { $divide: ['$totalSeconds', 3600] } },
          },
        },
        {
          $project: {
            _id: 1,
            totalHours: { $round: ['$totalHours', 2] },
          },
        },
        {
          $sort: { '_id.year': 1, '_id.week': 1 },
        },
      ]);
    } else if (offset === 'month') {
      data = TimeEntries.aggregate([
        {
          $match: {
            createdDateTime: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $project: {
            createdYear: { $year: '$createdDateTime' },
            createdMonth: { $month: '$createdDateTime' },
            totalSeconds: 1,
          },
        },
        {
          $group: {
            _id: {
              year: '$createdYear',
              month: '$createdMonth',
            },
            totalHours: { $sum: { $divide: ['$totalSeconds', 3600] } },
          },
        },
        {
          $project: {
            _id: 1,
            totalHours: { $round: ['$totalHours', 2] },
          },
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 },
        },
      ]);
    }

    return data;
  }

  /**
   * Get map location statistics
   * Group and count all volunteers  by their lattitude and longitude
   */
  async function getMapLocations() {
    return UserProfile.aggregate([
      {
        $match: {
          isActive: true,
          'location.coords.lat': { $ne: null },
          'location.coords.lng': { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            lat: '$location.coords.lat',
            lng: '$location.coords.lng',
          },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  /**
   * Get the total number of active teams
   */
  async function getTotalActiveTeamCount(endDate, comparisonEndDate) {
    if (comparisonEndDate) {
      const res = await Team.aggregate([
        {
          $facet: {
            current: [
              {
                $match: {
                  isActive: true,
                  createdDatetime: { $lte: endDate },
                },
              },
              {
                $count: 'activeTeams',
              },
            ],
            comparison: [
              {
                $match: {
                  isActive: true,
                  createdDatetime: { $lte: comparisonEndDate },
                },
              },
              {
                $count: 'activeTeams',
              },
            ],
          },
        },
      ]);
      const data = {};
      data.current = res[0].current[0].activeTeams;
      data.comparison = res[0].comparison[0].activeTeams;
      data.percentage = calculateGrowthPercentage(data.current, data.comparison);
      return data;
    }
    const res = await Team.aggregate([
      {
        $match: {
          isActive: true,
          createdDatetime: { $lte: endDate },
        },
      },
      {
        $count: 'activeTeams',
      },
    ]);

    return { current: res[0].activeTeams };
  }

  /**
   *  Get the users celebrating their 6 month or 1 year anniversary within the given dates
   * @param {Date} isoStartDate
   * @param {Date} isoEndDate
   */
  async function getAnniversaries(
    isoStartDate,
    isoEndDate,
    isoComparisonStartDate,
    isoComparisonEndDate,
  ) {
    /**
     * Gets start and end dates exactly X months ago
     * @param {Date} startDate
     * @param {Date} endDate
     * @param {Number} timeDifferenceInMonths
     * @returns {{ startDate: Date, endDate: Date }}
     */
    const getPastDates = (startDate, endDate, timeDifferenceInMonths) => {
      const startDateCopy = new Date(startDate);
      startDateCopy.setMonth(startDateCopy.getMonth() - timeDifferenceInMonths);

      const endDateCopy = new Date(endDate);
      endDateCopy.setMonth(endDateCopy.getMonth() - timeDifferenceInMonths);

      return {
        startDate: startDateCopy,
        endDate: endDateCopy,
      };
    };

    /**
     * Gets list of users created within a given date range
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {Array<Object>} Array of user objects
     */
    const getUsersCreated = async (startDate, endDate) => {
      const users = await UserProfile.aggregate([
        {
          $match: {
            createdDate: {
              $gte: startDate,
              $lte: endDate,
            },
            isActive: true,
          },
        },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            profilePic: { $ifNull: ['$profilePic', null] },
          },
        },
      ]);
      return users;
    };

    const dates6MonthsAgo = getPastDates(isoStartDate, isoEndDate, 6);
    const dates1YearAgo = getPastDates(isoStartDate, isoEndDate, 12);

    const anniversaries6Months = await getUsersCreated(
      dates6MonthsAgo.startDate,
      dates6MonthsAgo.endDate,
    );
    const anniversaries1Year = await getUsersCreated(
      dates1YearAgo.startDate,
      dates1YearAgo.endDate,
    );

    const response = {
      '6Months': {
        users: anniversaries6Months,
      },
      '1Year': {
        users: anniversaries1Year,
      },
    };

    /**
     * If comparison dates are included in request,
     * modify response to include comparison percentages
     */
    if (isoComparisonStartDate && isoComparisonEndDate) {
      const comparisonDates6MonthsAgo = getPastDates(
        isoComparisonStartDate,
        isoComparisonEndDate,
        6,
      );
      const comparisonDates1YearAgo = getPastDates(
        isoComparisonStartDate,
        isoComparisonEndDate,
        12,
      );

      const comparisonAnniversaries6Months = await getUsersCreated(
        comparisonDates6MonthsAgo.startDate,
        comparisonDates6MonthsAgo.endDate,
      );
      const comparisonAnniversaries1Year = await getUsersCreated(
        comparisonDates1YearAgo.startDate,
        comparisonDates1YearAgo.endDate,
      );

      response['6Months'].comparisonPercentage = calculateGrowthPercentage(
        anniversaries6Months.length,
        comparisonAnniversaries6Months.length,
      );
      response['1Year'].comparisonPercentage = calculateGrowthPercentage(
        anniversaries1Year.length,
        comparisonAnniversaries1Year.length,
      );
    }

    return response;
  }

  /**
   * Get the data for Blue Square infringements between the two input dates.
   * @param {Date} isoStartDate
   * @param {Date} isoEndDate
   * @param {Date} isoComparisonStartDate
   * @param {Date} isoComparisonEndDate
   */
  async function getBlueSquareStats(
    isoStartDate,
    isoEndDate,
    isoComparisonStartDate,
    isoComparisonEndDate,
  ) {
    const getData = async (startDate, endDate) =>
      UserProfile.aggregate([
        {
          $unwind: {
            path: '$infringementsNew',
          },
        },
        {
          $match: {
            'infringementsNew.createdDate': {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: '$infringementsNew.reason',
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                {
                  $in: [
                    '$_id',
                    ['missingHours', 'missingSummary', 'missingHoursAndSummary', 'vacationTime'],
                  ],
                },
                '$_id',
                'other',
              ],
            },
            count: {
              $sum: '$count',
            },
          },
        },
      ]);

    const currData = await getData(isoStartDate, isoEndDate);

    const currTotalInfringements = currData.reduce((total, item) => {
      const currTotal = total + item.count;
      return currTotal;
    }, 0);

    const formattedData = currData.reduce((accum, item) => {
      accum[item._id] = {
        count: item.count,
        percentageOutOfTotal: Math.round((item.count / currTotalInfringements) * 100) / 100,
      };
      return accum;
    }, {});

    // fill missing fields
    const reasons = [
      'missingHours',
      'missingSummary',
      'missingHoursAndSummary',
      'vacationTime',
      'other',
    ];
    reasons.forEach((reason) => {
      if (!formattedData[reason]) {
        formattedData[reason] = { count: 0, percentageOutOfTotal: 0 };
      }
    });

    formattedData.totalBlueSquares = {
      count: currTotalInfringements,
    };

    if (isoComparisonStartDate && isoComparisonEndDate) {
      const comparisonData = await getData(isoComparisonStartDate, isoComparisonEndDate);

      const comparisonTotalInfringements = comparisonData.reduce((total, item) => {
        const currTotal = total + item.count;
        return currTotal;
      }, 0);

      formattedData.totalBlueSquares.comparisonPercentage = calculateGrowthPercentage(
        currTotalInfringements,
        comparisonTotalInfringements,
      );
    }

    return formattedData;
  }

  /**
   *  Get the number of members in team and not in team, with percentage
   */
  async function getTeamMembersCount(isoEndDate, isoComparisonEndDate) {
    // Gets counts for total members and members in team within a given time range
    const getData = async (endDate) => {
      const [data] = await UserProfile.aggregate([
        {
          $match: {
            isActive: true,
            createdDate: {
              $lte: endDate,
            },
          },
        },
        {
          $facet: {
            totalMembers: [
              {
                $count: 'count',
              },
            ],
            inTeam: [
              {
                $match: {
                  teams: {
                    $exists: true,
                    $ne: [],
                  },
                },
              },
              {
                $count: 'count',
              },
            ],
          },
        },
      ]);

      const totalMembers = data.totalMembers[0]?.count || 0;
      const usersInTeam = data.inTeam[0]?.count || 0;
      const usersNotInTeam = totalMembers - usersInTeam;

      return {
        totalMembers,
        usersInTeam,
        usersNotInTeam,
      };
    };

    const {
      totalMembers: currentTotalMembers,
      usersInTeam: currentUsersInTeam,
      usersNotInTeam: currentUsersNotInTeam,
    } = await getData(isoEndDate);

    // Calculate percentages out of total
    const percentageOutOfTotalInTeam =
      Math.round((currentUsersInTeam / currentTotalMembers) * 100) / 100;
    const percentageOutOfTotalNotInTeam =
      Math.round((currentUsersNotInTeam / currentTotalMembers) * 100) / 100;

    // Calculate comparison percentages
    const { usersInTeam: comparisonUsersInTeam, usersNotInTeam: comparisonUsersNotInTeam } =
      await getData(isoComparisonEndDate);
    const comparisonPercentageInTeam = calculateGrowthPercentage(
      currentUsersInTeam,
      comparisonUsersInTeam,
    );
    const comparisonPercentageNotInTeam = calculateGrowthPercentage(
      currentUsersNotInTeam,
      comparisonUsersNotInTeam,
    );

    return {
      inTeam: {
        count: currentUsersInTeam,
        percentageOutOfTotal: percentageOutOfTotalInTeam,
        comparisonPercentage: comparisonPercentageInTeam,
      },
      notInTeam: {
        count: currentUsersNotInTeam,
        percentageOutOfTotal: percentageOutOfTotalNotInTeam,
        comparisonPercentage: comparisonPercentageNotInTeam,
      },
    };
  }

  /** aggregates role distribution statistics
   * counts total number of volunteers that fall within each of the different roles
   */
  async function getRoleDistributionStats() {
    const roleStats = UserProfile.aggregate([
      {
        $match: { isActive: true },
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    return roleStats;
  }

  /**
   * aggregates the total number of hours worked between the 5 categories
   * Food, Energy, Housing, Stewardship, Society, Economics and Other
   */
  async function getWorkDistributionStats(startDate, endDate) {
    return Project.aggregate([
      {
        $lookup: {
          from: 'timeEntries',
          localField: '_id',
          foreignField: 'projectId',
          as: 'times',
        },
      },
      {
        $unwind: {
          path: '$times',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          'times.dateOfWork': {
            $gte: moment(startDate).format('YYYY-MM-DD'),
            $lte: moment(endDate).format('YYYY-MM-DD'),
          },
        },
      },
      {
        $group: {
          _id: '$category',
          aggregatedSeconds: { $sum: '$times.totalSeconds' },
        },
      },
      {
        $project: {
          _id: 1,
          totalHours: { $divide: ['$aggregatedSeconds', 3600] },
        },
      },
    ]);
  }

  async function getTasksStats(startDate, endDate, comparisonStartDate, comparisonEndDate) {
    if (comparisonStartDate && comparisonEndDate) {
      const taskStats = await Task.aggregate([
        {
          $facet: {
            current: [
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
            ],
            comparison: [
              {
                $match: {
                  modifiedDatetime: { $gte: comparisonStartDate, $lte: comparisonEndDate },
                  status: { $in: ['Complete', 'Active'] },
                },
              },
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]);

      const data = { current: {}, comparison: {} };
      for (const key in taskStats[0]) {
        const active = taskStats[0][key].find((x) => x._id === 'Active');
        data[key].active = active ? active.count : 0;

        const complete = taskStats[0][key].find((x) => x._id === 'Complete');
        data[key].complete = complete ? complete.count : 0;
      }

      return {
        active: {
          current: data.current.active,
          percentage: calculateGrowthPercentage(data.current.active, data.comparison.active),
        },
        complete: {
          current: data.current.complete,
          percentage: calculateGrowthPercentage(data.current.complete, data.comparison.complete),
        },
      };
    }
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

    const data = {};
    const active = taskStats.find((x) => x._id === 'Active');
    const complete = taskStats.find((x) => x._id === 'Complete');
    data.active = { current: active?.count || 0 };
    data.complete = { current: complete?.count || 0 };
    return data;
  }
  /**
   * Get the volunteer hours stats, it retrieves the number of hours logged by users between the two input dates as well as their weeklycommittedHours.
   * @param {*} startDate
   * @param {*} endDate
   */
  // async function getHoursStats(startDate, endDate) {
  //   const hoursStats = await UserProfile.aggregate([
  //     {
  //       $match: {
  //         isActive: true,
  //       },
  //     },
  //     {
  //       $lookup: {
  //         from: 'timeEntries', // The collection to join
  //         localField: '_id', // Field from the userProfile collection
  //         foreignField: 'personId', // Field from the timeEntries collection
  //         as: 'timeEntries', // The array field that will contain the joined documents
  //       },
  //     },
  //     {
  //       $unwind: {
  //         path: '$timeEntries',
  //         preserveNullAndEmptyArrays: true, // Preserve users with no time entries
  //       },
  //     },
  //     {
  //       $match: {
  //         $or: [
  //           { timeEntries: { $exists: false } },
  //           {
  //             'timeEntries.dateOfWork': {
  //               $gte: moment(startDate).format('YYYY-MM-DD'),
  //               $lte: moment(endDate).format('YYYY-MM-DD'),
  //             },
  //           },
  //         ],
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: '$_id',
  //         personId: { $first: '$_id' },
  //         totalSeconds: { $sum: '$timeEntries.totalSeconds' }, // Sum seconds from timeEntries
  //         weeklycommittedHours: { $first: `$weeklycommittedHours` }, // Include the weeklycommittedHours field
  //       },
  //     },
  //     {
  //       $project: {
  //         totalHours: { $divide: ['$totalSeconds', 3600] }, // Convert seconds to hours
  //         weeklycommittedHours: 1, // make sure we include it in the end result
  //       },
  //     },
  //     {
  //       $bucket: {
  //         groupBy: '$totalHours',
  //         boundaries: [0, 10, 20, 30, 40],
  //         default: 40,
  //         output: {
  //           count: { $sum: 1 },
  //         },
  //       },
  //     },
  //   ]);

  //   for (let i = 0; i < 5; i++) {
  //     if (!hoursStats.find((x) => x._id === i * 10)) {
  //       hoursStats.push({ _id: i * 10, count: 0 });
  //     }
  //   }

  //   return hoursStats;
  // }

  // Updated
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
            {
              'timeEntries.dateOfWork': {
                $gte: moment(startDate).format('YYYY-MM-DD'),
                $lte: moment(endDate).format('YYYY-MM-DD'),
              },
            },
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
          boundaries: [10, 20, 30, 35, 40],
          default: 40,
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ]);

    // Change category labels using if conditions
    hoursStats.forEach((stat) => {
      if (stat._id === 10) {
        stat._id = '10-19.99';
      } else if (stat._id === 20) {
        stat._id = '20-29.99';
      } else if (stat._id === 30) {
        stat._id = '30-34.99';
      } else if (stat._id === 35) {
        stat._id = '35-39.99';
      } else if (stat._id === 40) {
        stat._id = '40+';
      }
    });

    // Ensure each specific range label has a value, even if zero
    if (!hoursStats.find((x) => x._id === '10-19.99')) {
      hoursStats.push({ _id: '10-19.99', count: 0 });
    }
    if (!hoursStats.find((x) => x._id === '20-29.99')) {
      hoursStats.push({ _id: '20-29.99', count: 0 });
    }
    if (!hoursStats.find((x) => x._id === '30-34.99')) {
      hoursStats.push({ _id: '30-34.99', count: 0 });
    }
    if (!hoursStats.find((x) => x._id === '35-39.99')) {
      hoursStats.push({ _id: '35-39.99', count: 0 });
    }
    if (!hoursStats.find((x) => x._id === '40+')) {
      hoursStats.push({ _id: '40+', count: 0 });
    }

    // Sort the result to maintain consistent order (optional)
    const order = ['10-19.99', '20-29.99', '30-34.99', '35-39.99', '40+'];
    hoursStats.sort((a, b) => order.indexOf(a._id) - order.indexOf(b._id));

    return hoursStats;
  }

  /**
   * Aggregates total number of hours worked across all volunteers within the specified date range
   */
  async function getTotalHoursWorked(startDate, endDate, comparisonStartDate, comparisonEndDate) {
    if (!comparisonStartDate && !comparisonEndDate) {
      const data = await TimeEntries.aggregate([
        {
          $match: {
            dateOfWork: {
              $gte: moment(startDate).format('YYYY-MM-DD'),
              $lte: moment(endDate).format('YYYY-MM-DD'),
            },
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

      return { current: data[0].totalHours };
    }
    const data = await TimeEntries.aggregate([
      {
        $facet: {
          currentTotalHours: [
            {
              $match: {
                dateOfWork: {
                  $gte: moment(startDate).format('YYYY-MM-DD'),
                  $lte: moment(endDate).format('YYYY-MM-DD'),
                },
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
          ],

          comparisonTotalHours: [
            {
              $match: {
                dateOfWork: {
                  $gte: moment(comparisonStartDate).format('YYYY-MM-DD'),
                  $lte: moment(comparisonEndDate).format('YYYY-MM-DD'),
                },
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
          ],
        },
      },
    ]);

    const current = data[0].currentTotalHours[0]?.totalHours || 0;
    const comparison = data[0].comparisonTotalHours[0]?.totalHours || 0;
    return { current, comparison, percentage: calculateGrowthPercentage(current, comparison) };
  }

  /**
   * returns the number of:
   * 1. Active volunteers
   * 2. New volunteers
   * 3. Deactivated volunteers
   * all within a given time range.
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {Date} comparisonStartDate
   * @param {Date} comparisonEndDate
   */
  const getVolunteerNumberStats = async (
    startDate,
    endDate,
    comparisonStartDate,
    comparisonEndDate,
  ) => {
    const getVolunteerData = async (isoStartDate, isoEndDate) => {
      const data = await UserProfile.aggregate([
        {
          $facet: {
            activeVolunteers: [
              {
                $match: {
                  isActive: true,
                  createdDate: { $lte: isoEndDate },
                },
              },
              { $count: 'count' },
            ],
            newVolunteers: [
              {
                $match: {
                  createdDate: {
                    $gte: isoStartDate,
                    $lte: isoEndDate,
                  },
                },
              },
              { $count: 'count' },
            ],
            deactivatedVolunteers: [
              {
                $match: {
                  $and: [
                    { lastModifiedDate: { $gte: isoStartDate } },
                    { lastModifiedDate: { $lte: isoEndDate } },
                    { isActive: false },
                  ],
                },
              },
              { $count: 'count' },
            ],
          },
        },
      ]);

      const activeVolunteers = data[0].activeVolunteers[0]?.count || 0;
      const newVolunteers = data[0].newVolunteers[0]?.count || 0;
      const deactivatedVolunteers = data[0].deactivatedVolunteers[0]?.count || 0;
      const totalVolunteers = activeVolunteers + newVolunteers + deactivatedVolunteers;

      return {
        activeVolunteers,
        newVolunteers,
        deactivatedVolunteers,
        totalVolunteers,
      };
    };

    // Get data for the current time range
    const {
      activeVolunteers: currentActiveVolunteers,
      newVolunteers: currentNewVolunteers,
      deactivatedVolunteers: currentDeactivatedVolunteers,
      totalVolunteers: currentTotalVolunteers,
    } = await getVolunteerData(startDate, endDate);

    const res = {
      activeVolunteers: {
        count: currentActiveVolunteers,
        percentageOutOfTotal:
          Math.round((currentActiveVolunteers / currentTotalVolunteers) * 100) / 100,
      },
      newVolunteers: {
        count: currentNewVolunteers,
        percentageOutOfTotal:
          Math.round((currentNewVolunteers / currentTotalVolunteers) * 100) / 100,
      },
      deactivatedVolunteers: {
        count: currentDeactivatedVolunteers,
        percentageOutOfTotal:
          Math.round((currentDeactivatedVolunteers / currentTotalVolunteers) * 100) / 100,
      },
      totalVolunteers: { count: currentTotalVolunteers },
    };

    // Add comparison percentage if comparison dates are provided
    if (comparisonStartDate && comparisonEndDate) {
      const {
        activeVolunteers: comparisonActiveVolunteers,
        newVolunteers: comparisonNewVolunteers,
        deactivatedVolunteers: comparisonDeactivatedVolunteers,
        totalVolunteers: comparisonTotalVolunteers,
      } = await getVolunteerData(comparisonStartDate, comparisonEndDate);

      // Add comparison percentage using calculateGrowthPercentage function
      res.activeVolunteers.comparisonPercentage = calculateGrowthPercentage(
        currentActiveVolunteers,
        comparisonActiveVolunteers,
      );
      res.newVolunteers.comparisonPercentage = calculateGrowthPercentage(
        currentNewVolunteers,
        comparisonNewVolunteers,
      );
      res.deactivatedVolunteers.comparisonPercentage = calculateGrowthPercentage(
        currentDeactivatedVolunteers,
        comparisonDeactivatedVolunteers,
      );
      res.totalVolunteers.comparisonPercentage = calculateGrowthPercentage(
        currentTotalVolunteers,
        comparisonTotalVolunteers,
      );
    }

    return res;
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
  async function getTotalBadgesAwardedCount(
    startDate,
    endDate,
    comparisonStartDate,
    comparisonEndDate,
  ) {
    if (comparisonStartDate && comparisonEndDate) {
      const res = await UserProfile.aggregate([
        {
          $facet: {
            current: [
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
            ],
            comparison: [
              {
                $unwind: '$badgeCollection',
              },
              {
                $match: {
                  'badgeCollection.earnedDate': {
                    $gte: moment(comparisonStartDate).format('YYYY-MM-DD'),
                    $lte: moment(comparisonEndDate).format('YYYY-MM-DD'),
                  },
                },
              },
              {
                $count: 'badgeCollection',
              },
            ],
          },
        },
      ]);

      const data = {};
      data.current = res[0].current[0].badgeCollection;
      data.comparison = res[0].comparison[0].badgeCollection;
      data.percentage = calculateGrowthPercentage(data.current, data.comparison);
      return data;
    }
    const res = await UserProfile.aggregate([
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

    return { current: res[0].badgeCollection };
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
   * 3. Comparison data for task and project hours
   * 4. Percentage for submitted-to-committed hours for Tasks and Projects
   *
   * (REVIEW: The remaining 3 pieces of data may be dead code; check for relevance)
   * 5. Number of member with tasks assigned
   * 6. Number of member without tasks assigned
   * 7. Number of tasks with due date within the date range
   *
   * All parameters are in the format 'YYYY-MM-DD'
   * @param {string} startDate
   * @param {string} endDate
   * @param {string} comparisonStartDate
   * @param {string} comparisonEndDate
   */
  async function getTaskAndProjectStats(
    startDate,
    endDate,
    comparisonStartDate,
    comparisonEndDate,
  ) {
    // 1. Retrieves the total hours logged to tasks for a given date range.
    const getTaskHours = async (start, end) => {
      const taskHours = await TimeEntries.aggregate([
        {
          $match: {
            dateOfWork: { $gte: start, $lte: end },
            taskId: { $exists: true, $type: 'objectId' },
            isTangible: { $eq: true },
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
      return taskHours[0]?.totalHours;
    };
    let taskHours = await getTaskHours(startDate, endDate);
    taskHours = taskHours ? Number(taskHours.toFixed(2)) : 0;

    // 2. Retrieves the total hours logged to projects for a given date range.
    const getProjectHours = async (start, end) => {
      const projectHours = await TimeEntries.aggregate([
        {
          $match: {
            dateOfWork: { $gte: start, $lte: end },
            projectId: { $exists: true },
            isTangible: { $eq: true },
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
      return projectHours[0]?.totalHours;
    };
    let projectHours = await getProjectHours(startDate, endDate);
    projectHours = projectHours ? Number(projectHours.toFixed(2)) : 0;

    // 3. Calculates comparison percentages for task and project hours
    let tasksComparisonPercentage;
    let projectsComparisonPercentage;
    if (comparisonStartDate && comparisonEndDate) {
      const comparisonTaskHours = await getTaskHours(comparisonStartDate, comparisonEndDate);
      const comparisonProjectHours = await getProjectHours(comparisonStartDate, comparisonEndDate);
      tasksComparisonPercentage = calculateGrowthPercentage(taskHours, comparisonTaskHours);
      projectsComparisonPercentage = calculateGrowthPercentage(
        projectHours,
        comparisonProjectHours,
      );
    }

    // Calculates the number of weeks, rounded up, for a given time range.
    function weeksBetweenDates(startDateStr, endDateStr) {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      const timeDifferenceInMilliseconds = end - start;
      const weeksDifference = timeDifferenceInMilliseconds / (1000 * 60 * 60 * 24 * 7);
      return Math.ceil(weeksDifference);
    }
    const numberOfWeeks = weeksBetweenDates(startDate, endDate);

    // 4. Retrieves the total committed hours that should have been completed for the given date range.
    const getTotalCommittedHours = await UserProfile.aggregate([
      {
        $match: {
          weeklycommittedHoursHistory: { $exists: true },
        },
      },
      {
        $project: {
          weeklyCommittedHoursHistoryBeforeEndDate: {
            $filter: {
              input: '$weeklycommittedHoursHistory',
              as: 'history',
              cond: { $lte: ['$$history.dateChanged', new Date(endDate)] },
            },
          },
        },
      },
      {
        $match: {
          $expr: { $gt: [{ $size: '$weeklyCommittedHoursHistoryBeforeEndDate' }, 1] },
        },
      },
      {
        $project: {
          committedHours: {
            $let: {
              vars: {
                sortedHistory: {
                  $sortArray: {
                    input: '$weeklyCommittedHoursHistoryBeforeEndDate',
                    sortBy: { dateChanged: -1 },
                  },
                },
              },
              in: { $multiply: [{ $arrayElemAt: ['$$sortedHistory.hours', 0] }, numberOfWeeks] },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalCommittedHours: { $sum: '$committedHours' },
        },
      },
      {
        $project: {
          totalCommittedHours: { $round: ['$totalCommittedHours', 2] },
        },
      },
    ]);
    const totalCommittedHours =
      getTotalCommittedHours.length > 0 ? Number(getTotalCommittedHours[0].totalCommittedHours) : 0;

    // 5. Number of member with tasks assigned
    const membersWithTasks = await Task.distinct('resources.userID', {
      'resources.userID': { $exists: true },
      completedTask: { $ne: true },
    });

    // 6. Number of member without tasks assigned
    const membersWithoutTasks = await UserProfile.countDocuments({
      _id: { $nin: membersWithTasks },
    });

    // 7. Number of tasks with due date within the date range
    const tasksDueWithinDate = await Task.countDocuments({
      dueDatetime: { $gte: startDate, $lte: endDate },
    });

    const taskAndProjectStats = {
      taskHours: {
        count: taskHours,
        submittedToCommittedHoursPercentage: Number((taskHours / totalCommittedHours).toFixed(2)),
        comparisonPercentage: tasksComparisonPercentage,
      },
      projectHours: {
        count: projectHours,
        submittedToCommittedHoursPercentage: Number(
          (projectHours / totalCommittedHours).toFixed(2),
        ),
        comparisonPercentage: projectsComparisonPercentage,
      },
      membersWithTasks: membersWithTasks.length,
      membersWithoutTasks,
      tasksDueThisWeek: tasksDueWithinDate,
    };

    return taskAndProjectStats;
  }

  /**
   * Gets the total number of teams with a minimum number of active members
   * within a given end date.
   * @param {Date} isoEndDate
   * @param {Number} activeMembersMinimum
   */
  async function getTeamsWithActiveMembers(isoEndDate, activeMembersMinimum) {
    const result = await Team.aggregate([
      {
        $match: {
          isActive: true,
          createdDatetime: { $lte: isoEndDate },
        },
      },
      {
        $unwind: '$members',
      },
      // Access user profile details
      {
        $lookup: {
          from: 'userProfiles',
          localField: 'members.userId',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      // Filter for only active team members
      {
        $match: {
          userDetails: {
            $elemMatch: { isActive: true },
          },
        },
      },
      // Group members in the same team back together and count its number of active members
      {
        $group: {
          _id: '$_id',
          activeMembersCount: { $sum: 1 },
        },
      },
      // Filter for teams who have an active member count >= activeMembersNum
      {
        $match: {
          activeMembersCount: { $gte: activeMembersMinimum },
        },
      },
      {
        $count: 'totalTeams',
      },
    ]);

    const totalTeams = result[0]?.totalTeams ? result[0].totalTeams : 0;

    return { count: totalTeams };
  }

  async function getVolunteersOverAssignedTime(isoStartDate, isoEndDate) {
    const volunteersOverAssignedTime = await UserProfile.aggregate([
      {
        $match: {
          isActive: true, // Only active users
        },
      },
      {
        $lookup: {
          from: 'timeEntries',
          localField: '_id',
          foreignField: 'personId',
          as: 'timeEntries',
        },
      },
      {
        $unwind: {
          path: '$timeEntries',
          preserveNullAndEmptyArrays: false, // Exclude users with no time entries
        },
      },
      {
        $match: {
          'timeEntries.createdDateTime': {
            $gte: isoStartDate,
            $lte: isoEndDate,
          },
        },
      },
      {
        $group: {
          _id: '$_id',
          totalSeconds: { $sum: '$timeEntries.totalSeconds' }, // Total time in seconds
          weeklycommittedHours: { $first: '$weeklycommittedHours' }, // Assigned weekly hours
        },
      },
      {
        $project: {
          totalHours: { $divide: ['$totalSeconds', 3600] }, // Convert total time to hours
          weeklycommittedHours: 1,
          hoursOverCommitment: {
            $subtract: [{ $divide: ['$totalSeconds', 3600] }, '$weeklycommittedHours'], // Calculate hours over commitment
          },
        },
      },
      {
        $match: {
          weeklycommittedHours: { $gte: 10 }, // Exclude volunteers with < 10 committed hours
          hoursOverCommitment: { $gte: 1 }, // Include only volunteers over by 1 hour or more
        },
      },
      {
        $count: 'volunteersOverAssignedTime', // Count matching volunteers
      },
    ]);

    return { count: volunteersOverAssignedTime[0]?.volunteersOverAssignedTime || 0 };
  }

  async function getVolunteersCompletedAssignedHours(
    isoStartDate,
    isoEndDate,
    isoComparisonStartDate,
    isoComparisonEndDate,
  ) {
    // Helper function to get count of volunteers meeting their commitment.
    const getCompletedHoursData = async (start, end) => {
      const hoursStats = await UserProfile.aggregate([
        {
          $match: {
            isActive: true,
          },
        },
        {
          $lookup: {
            from: 'timeEntries',
            localField: '_id',
            foreignField: 'personId',
            as: 'timeEntries',
          },
        },
        {
          $unwind: {
            path: '$timeEntries',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            $or: [
              { timeEntries: { $exists: false } },
              {
                'timeEntries.createdDateTime': {
                  $gte: start,
                  $lte: end,
                },
              },
            ],
          },
        },
        {
          $group: {
            _id: '$_id',
            totalSeconds: { $sum: '$timeEntries.totalSeconds' },
            weeklycommittedHours: { $first: '$weeklycommittedHours' },
          },
        },
        {
          $project: {
            totalHours: { $divide: ['$totalSeconds', 3600] },
            weeklycommittedHours: 1,
          },
        },
        {
          $match: {
            $expr: { $gte: ['$totalHours', '$weeklycommittedHours'] },
          },
        },
        {
          $count: 'metCommitment',
        },
      ]);

      return hoursStats[0]?.metCommitment || 0;
    };

    const currentCount = await getCompletedHoursData(isoStartDate, isoEndDate);

    if (isoComparisonStartDate && isoComparisonEndDate) {
      const comparisonCount = await getCompletedHoursData(
        isoComparisonStartDate,
        isoComparisonEndDate,
      );
      const comparisonPercentage = calculateGrowthPercentage(currentCount, comparisonCount);

      return {
        count: currentCount,
        comparisonPercentage,
      };
    }

    return { count: currentCount };
  }

  const getTotalSummariesSubmitted = async (
    startDate,
    endDate,
    comparisonStartDate,
    comparisonEndDate,
  ) => {
    // Helper function to count summaries submitted within a date range
    const getSummariesCount = async (start, end) =>
      UserProfile.aggregate([
        {
          $match: {
            summarySubmissionDates: {
              $elemMatch: {
                $gte: new Date(start),
                $lte: new Date(end),
              },
            },
          },
        },
        {
          $project: {
            totalSummaries: {
              $size: {
                $filter: {
                  input: '$summarySubmissionDates',
                  as: 'date',
                  cond: {
                    $and: [
                      { $gte: ['$$date', new Date(start)] },
                      { $lte: ['$$date', new Date(end)] },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSummaries: { $sum: '$totalSummaries' },
          },
        },
      ]);

    // Get summaries count for the current date range
    const currentSummaries = await getSummariesCount(startDate, endDate);
    const totalCurrentSummaries = currentSummaries[0]?.totalSummaries || 0;

    // If comparison dates are provided, calculate the comparison percentage
    if (comparisonStartDate && comparisonEndDate) {
      const comparisonSummaries = await getSummariesCount(comparisonStartDate, comparisonEndDate);
      const totalComparisonSummaries = comparisonSummaries[0]?.totalSummaries || 0;
      const comparisonPercentage = calculateGrowthPercentage(
        totalCurrentSummaries,
        totalComparisonSummaries,
      );

      return { count: totalCurrentSummaries, comparisonPercentage };
    }

    // If no comparison dates, return only the count
    return { count: totalCurrentSummaries };
  };

  return {
    getVolunteerTrends,
    getMapLocations,
    getTotalActiveTeamCount,
    getAnniversaries,
    getRoleDistributionStats,
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
    getVolunteersCompletedHours,
    getTeamsWithActiveMembers,
    getVolunteersOverAssignedTime,
    getVolunteersCompletedAssignedHours,
    getTotalSummariesSubmitted,
  };
};

module.exports = overviewReportHelper;
