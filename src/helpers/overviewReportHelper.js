/* eslint-disable no-plusplus */
/* eslint-disable quotes */
/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
const moment = require('moment');
const Team = require('../models/team');
const UserProfile = require('../models/userProfile');
const TimeEntries = require('../models/timeentry');
const Task = require('../models/task');
const Project = require('../models/project');

function calculateGrowthPercentage(current, prev) {
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
   */
  async function getVolunteerTrends() {
    const currentDate = moment();
    const startDate = currentDate.clone().subtract(11, 'months').startOf('month').toDate();
    const endDate = currentDate.clone().endOf('month').toDate();

    return TimeEntries.aggregate([
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
          _id: {
            year: { $year: { $dateFromString: { dateString: '$dateOfWork' } } },
            month: { $month: { $dateFromString: { dateString: '$dateOfWork' } } },
          },
          totalSecondsWorked: {
            $sum: '$totalSeconds',
          },
        },
      },
      {
        $project: {
          _id: 1,
          totalHours: {
            $divide: ['$totalSecondsWorked', 3600],
          },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);
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
   *  Get the users celebrating their anniversary between the two input dates.
   * @param {*} startDate
   * @param {*} endDate
   * @returns  The number of users celebrating their anniversary between the two input dates.
   */
  async function getAnniversaries(startDate, endDate) {
    return UserProfile.aggregate([
      {
        $addFields: {
          createdMonthDay: { $dateToString: { format: '%m-%d', date: '$createdDate' } },
        },
      },
      {
        $match: {
          createdMonthDay: {
            $gte: startDate.substring(5, 10),
            $lte: endDate.substring(5, 10),
          },
          isActive: true,
        },
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
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
        $group: {
          _id: '$infringements.description',
          count: { $sum: 1 },
        },
      },
    ]);
  }

  /**
   *  Get the number of members in team and not in team, with percentage
   */
  async function getTeamMembersCount() {
    const [data] = await UserProfile.aggregate([
      {
        $match: {
          isActive: true,
        },
      },
      {
        $facet: {
          totalMembers: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                count: 1,
              },
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
              $count: 'usersInTeam',
            },
          ],
        },
      },
    ]);

    return data;
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

    const current = data[0].currentTotalHours[0].totalHours;
    const comparison = data[0].comparisonTotalHours[0].totalHours;
    return { current, comparison, percentage: calculateGrowthPercentage(current, comparison) };
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
  const getVolunteerNumberStats = async (
    startDate,
    endDate,
    comparisonStartDate,
    comparisonEndDate,
  ) => {
    if (comparisonStartDate !== undefined && comparisonEndDate !== undefined) {
      const [data] = await UserProfile.aggregate([
        {
          $facet: {
            currentActiveVolunteers: [
              {
                $match: {
                  createdDate: {
                    $lte: endDate,
                  },
                  isActive: true,
                },
              },
              { $count: 'activeVolunteersCount' },
            ],

            comparisonActiveVolunteers: [
              {
                $match: {
                  createdDate: {
                    $lte: comparisonEndDate,
                  },
                  isActive: true,
                },
              },
              { $count: 'activeVolunteersCount' },
            ],

            currentNewVolunteers: [
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

            comparisonNewVolunteers: [
              {
                $match: {
                  createdDate: {
                    $gte: comparisonStartDate,
                    $lte: comparisonEndDate,
                  },
                },
              },
              { $count: 'newVolunteersCount' },
            ],

            currentDeactivatedVolunteers: [
              {
                $match: {
                  $and: [
                    { lastModifiedDate: { $gte: startDate } },
                    { lastModifiedDate: { $lte: endDate } },
                    { isActive: false },
                  ],
                },
              },
              { $count: 'deactivatedVolunteersCount' },
            ],

            comparisonDeactivatedVolunteers: [
              {
                $match: {
                  $and: [
                    { lastModifiedDate: { $gte: comparisonStartDate } },
                    { lastModifiedDate: { $lte: comparisonEndDate } },
                    { isActive: false },
                  ],
                },
              },
              { $count: 'deactivatedVolunteersCount' },
            ],
          },
        },
      ]);

      const currentActiveVolunteers = data.currentActiveVolunteers[0]?.activeVolunteersCount || 0;
      const comparisonActiveVolunteers =
        data.comparisonActiveVolunteers[0]?.activeVolunteersCount || 0;
      const newVolunteers = data.currentNewVolunteers[0]?.newVolunteersCount || 0;
      const comparisonNewVolunteers = data.comparisonNewVolunteers[0]?.newVolunteersCount || 0;
      const currentDeactivatedVolunteers =
        data.currentDeactivatedVolunteers[0]?.deactivatedVolunteersCount || 0;
      const comparisonDeactivatedVolunteers =
        data.comparisonDeactivatedVolunteers[0]?.deactivatedVolunteersCount || 0;

      const res = {
        activeVolunteers: {
          count: currentActiveVolunteers,
          percentage: calculateGrowthPercentage(
            currentActiveVolunteers,
            comparisonActiveVolunteers,
          ),
        },

        newVolunteers: {
          count: newVolunteers,
          percentage: calculateGrowthPercentage(newVolunteers, comparisonNewVolunteers),
        },

        deactivatedVolunteers: {
          count: currentDeactivatedVolunteers,
          percentage: calculateGrowthPercentage(
            currentDeactivatedVolunteers,
            comparisonDeactivatedVolunteers,
          ),
        },
      };

      return res;
    }
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
    const activeVolunteers = data[0].activeVolunteers[0]?.activeVolunteersCount || 0;
    const newVolunteers = data[0].newVolunteers[0]?.newVolunteersCount || 0;
    const deactivatedVolunteers = data[0].deactivatedVolunteers[0]?.deactivatedVolunteersCount || 0;

    const transformedData = {
      activeVolunteers: { count: activeVolunteers },
      newVolunteers: { count: newVolunteers },
      deactivatedVolunteers: { count: deactivatedVolunteers },
    };

    return transformedData;
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
    comparisonEndDate
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
      return taskHours[0].totalHours;
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
      return projectHours[0].totalHours;
    };
    let projectHours = await getProjectHours(startDate, endDate);
    projectHours = projectHours ? Number(projectHours.toFixed(2)) : 0;

    // 3. Calculates comparison percentages for task and project hours
    let tasksComparisonPercentage;
    let projectsComparisonPercentage;
    if (comparisonStartDate && comparisonEndDate ) {
      const comparisonTaskHours = await getTaskHours(comparisonStartDate, comparisonEndDate);
      const comparisonProjectHours = await getProjectHours(comparisonStartDate, comparisonEndDate);
      tasksComparisonPercentage = calculateGrowthPercentage(taskHours, comparisonTaskHours);
      projectsComparisonPercentage = calculateGrowthPercentage(projectHours, comparisonProjectHours);
    };

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
          weeklycommittedHoursHistory: { $exists: true}
        }
      },
      {
        $project: { 
          weeklyCommittedHoursHistoryBeforeEndDate: {
            $filter: {
              input: "$weeklycommittedHoursHistory",
              as: "history",
              cond: {$lte: ["$$history.dateChanged", new Date(endDate)]}
            }
          }
        },
      },
      {
        $match : {
          $expr: { $gt: [{$size: "$weeklyCommittedHoursHistoryBeforeEndDate"}, 1]}
        }
      },
      {
        $project: { 
          committedHours: {
            $let: {
              vars: {
                sortedHistory: {
                  $sortArray: {
                    input: "$weeklyCommittedHoursHistoryBeforeEndDate",
                    sortBy: { dateChanged: -1}
                  }
                }
              },
              in: { $multiply: [{ $arrayElemAt: [ "$$sortedHistory.hours", 0] }, numberOfWeeks ] }
            }
          }
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
          totalCommittedHours: { $round: ["$totalCommittedHours", 2] }
        }
      }
    ]);
    const totalCommittedHours = getTotalCommittedHours.length > 0 
      ? Number(getTotalCommittedHours[0].totalCommittedHours) : 0;

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
        submittedToCommittedHoursPercentage: Number((projectHours / totalCommittedHours).toFixed(2)),
        comparisonPercentage: projectsComparisonPercentage,
      },
      membersWithTasks: membersWithTasks.length,
      membersWithoutTasks,
      tasksDueThisWeek: tasksDueWithinDate,
    };

    return taskAndProjectStats;
  }

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
  };
};

module.exports = overviewReportHelper;
