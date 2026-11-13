const mongoose = require('mongoose');
const BuildingTimeLog = require('../../models/bmdashboard/buildingTimeLogger');
const logger = require('../../startup/logger');
const { hasPermission } = require('../../utilities/permissions');

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_IN_MILLISECOND =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const PERCENTAGE_MULTIPLIER = 100;

function isValidCalendarDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateParams(query) {
  const { start_date: startDate, end_date: endDate, project, member } = query;
  const errors = [];
  if ((startDate && !endDate) || (!startDate && endDate)) {
    errors.push('start_date and end_date must be provided together');
  }
  const invalidStartDate = startDate && !isValidCalendarDate(startDate);
  const invalidEndDate = endDate && !isValidCalendarDate(endDate);
  if (invalidStartDate) errors.push('Invalid start_date. Please use a valid YYYY-MM-DD date');
  if (invalidEndDate) errors.push('Invalid end_date. Please use a valid YYYY-MM-DD date');
  const reversedRange =
    startDate && endDate && !invalidStartDate && !invalidEndDate && startDate > endDate;
  if (reversedRange) errors.push('Invalid date range: start_date must be before or equal to end_date');

  [
    ['project', project],
    ['member', member],
  ].forEach(([label, value]) => {
    if (value && !mongoose.Types.ObjectId.isValid(value)) errors.push(`Invalid ${label} id`);
  });
  return { startDate, endDate, project, member, errors };
}

function buildMatch({ startDate, endDate, project, member }) {
  const match = { status: 'completed', totalElapsedTime: { $gt: 0 } };
  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(`${startDate}T00:00:00.000Z`),
      $lte: new Date(`${endDate}T23:59:59.999Z`),
    };
  }
  if (project) match.project = new mongoose.Types.ObjectId(project);
  if (member) match.member = new mongoose.Types.ObjectId(member);
  return match;
}

function formatDistribution(rows) {
  const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);
  return {
    total_hours: Number(totalHours.toFixed(2)),
    distribution: rows.map((row) => ({
      task: row.task,
      hours: Number(row.hours.toFixed(2)),
      percentage:
        totalHours > 0
          ? Number(((row.hours / totalHours) * PERCENTAGE_MULTIPLIER).toFixed(2))
          : 0,
    })),
  };
}

async function getFilterOptions() {
  const completedMatch = { status: 'completed', totalElapsedTime: { $gt: 0 } };
  const [projects, members] = await Promise.all([
    BuildingTimeLog.aggregate([
      { $match: completedMatch },
      { $group: { _id: '$project' } },
      { $lookup: { from: 'buildingProjects', localField: '_id', foreignField: '_id', as: 'item' } },
      { $unwind: '$item' },
      { $project: { _id: 0, id: '$_id', name: '$item.name' } },
      { $sort: { name: 1 } },
    ]),
    BuildingTimeLog.aggregate([
      { $match: completedMatch },
      { $group: { _id: '$member' } },
      { $lookup: { from: 'userProfiles', localField: '_id', foreignField: '_id', as: 'item' } },
      { $unwind: '$item' },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: { $trim: { input: { $concat: ['$item.firstName', ' ', '$item.lastName'] } } },
        },
      },
      { $sort: { name: 1 } },
    ]),
  ]);
  return { projects, members };
}

const laborHoursDistributionController = function () {
  const getLaborHoursDistribution = async function (req, res) {
    try {
      const hasAccess = await hasPermission(req.body.requestor, 'getWeeklySummaries');
      if (!hasAccess) {
        return res
          .status(403)
          .json({ error: 'You are not authorized to access labor hours distribution data' });
      }

      const params = validateParams(req.query);
      if (params.errors.length) return res.status(400).json({ error: params.errors[0] });

      const [rows, filters] = await Promise.all([
        BuildingTimeLog.aggregate([
          { $match: buildMatch(params) },
          {
            $group: {
              _id: {
                $cond: [
                  { $in: ['$task', [null, '', 'Default Task']] },
                  'Unspecified task',
                  '$task',
                ],
              },
              milliseconds: { $sum: '$totalElapsedTime' },
            },
          },
          {
            $project: {
              _id: 0,
              task: '$_id',
              hours: { $divide: ['$milliseconds', HOURS_IN_MILLISECOND] },
            },
          },
          { $sort: { hours: -1, task: 1 } },
        ]),
        getFilterOptions(),
      ]);

      return res.status(200).json({ ...formatDistribution(rows), filters });
    } catch (error) {
      logger.logException(error);
      return res
        .status(500)
        .json({ error: 'Error fetching labor hours distribution data. Please try again.' });
    }
  };
  return { getLaborHoursDistribution };
};

laborHoursDistributionController.testExports = {
  buildMatch,
  formatDistribution,
  isValidCalendarDate,
  validateParams,
};

module.exports = laborHoursDistributionController;
