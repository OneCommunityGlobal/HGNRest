const LaborHours = require('../../models/summaryDashboard/laborHours');
const logger = require('../../startup/logger');
const cache = require('../../utilities/nodeCache')();
const { hasPermission } = require('../../utilities/permissions');

const PERCENTAGE_MULTIPLIER = 100;

/**
 * Build aggregation pipeline for labor hours distribution
 */
function buildDistributionAggregation(startDate, endDate, categoryFilter) {
  const matchStage = {
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
  };

  if (categoryFilter) {
    matchStage.category = categoryFilter;
  }

  return [
    { $match: matchStage },
    { $group: { _id: '$category', hours: { $sum: '$hours' } } },
    { $project: { _id: 0, category: '$_id', hours: 1 } },
    { $sort: { hours: -1 } },
  ];
}

/**
 * Format aggregation results with percentages
 */
function formatDistribution(aggregationResult, totalHours) {
  return aggregationResult.map((item) => {
    const percentage =
      totalHours > 0
        ? Math.round((item.hours / totalHours) * PERCENTAGE_MULTIPLIER * 100) / 100
        : 0;
    return { category: item.category, hours: item.hours, percentage };
  });
}

/**
 * Check if a date string represents a valid calendar date (rejects invalid months, days, etc.)
 */
function isValidCalendarDate(dateString) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Validate query parameters
 */
function validateParams(query) {
  const { start_date: startDate, end_date: endDate, category } = query;
  const errors = [];

  if (!startDate || !endDate) {
    errors.push('Missing required query parameters: start_date and end_date are required');
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !dateRegex.test(startDate)) {
    errors.push('Invalid start_date format. Please use YYYY-MM-DD format');
  } else if (startDate && !isValidCalendarDate(startDate)) {
    errors.push('Invalid start_date: date does not exist (e.g., invalid month or day)');
  }
  if (endDate && !dateRegex.test(endDate)) {
    errors.push('Invalid end_date format. Please use YYYY-MM-DD format');
  } else if (endDate && !isValidCalendarDate(endDate)) {
    errors.push('Invalid end_date: date does not exist (e.g., invalid month or day)');
  }

  if (errors.length === 0 && startDate && endDate && new Date(startDate) > new Date(endDate)) {
    errors.push('Invalid date range: start_date must be before or equal to end_date');
  }

  return { startDate, endDate, category, errors };
}

/**
 * Controller for Labor Hours Distribution Pie Chart
 */
const laborHoursDistributionController = function () {
  /**
   * GET /api/labor-hours/distribution
   * Fetches aggregated labor hours data for pie chart visualization
   *
   * Query Parameters:
   * - start_date (required): Start date in YYYY-MM-DD format
   * - end_date (required): End date in YYYY-MM-DD format
   * - category (optional): Filter by specific category
   *
   * Response:
   * {
   *   "total_hours": 1000,
   *   "distribution": [
   *     { "category": "Team A", "hours": 200, "percentage": 20 },
   *     { "category": "Team B", "hours": 300, "percentage": 30 }
   *   ]
   * }
   */
  const getLaborHoursDistribution = async function (req, res) {
    try {
      const { requestor } = req.body;

      const hasAccess = await hasPermission(requestor, 'getWeeklySummaries');
      if (!hasAccess) {
        return res
          .status(403)
          .json({ error: 'You are not authorized to access labor hours distribution data' });
      }

      const { startDate, endDate, category, errors } = validateParams(req.query);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors[0] });
      }

      const cacheKey = `labor_hours_distribution:${startDate}:${endDate}:${category || 'all'}`;
      if (cache.hasCache(cacheKey)) {
        return res.status(200).json(cache.getCache(cacheKey));
      }

      const aggregationPipeline = buildDistributionAggregation(startDate, endDate, category);
      const aggregationResult = await LaborHours.aggregate(aggregationPipeline);

      const totalHours = aggregationResult.reduce((sum, item) => sum + (item.hours || 0), 0);

      const response = {
        total_hours: totalHours,
        distribution: formatDistribution(aggregationResult, totalHours),
      };

      cache.setCache(cacheKey, response);
      return res.status(200).json(response);
    } catch (error) {
      logger.logException(error);
      return res
        .status(500)
        .json({ error: 'Error fetching labor hours distribution data. Please try again.' });
    }
  };

  return { getLaborHoursDistribution };
};

module.exports = laborHoursDistributionController;
