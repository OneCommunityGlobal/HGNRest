const Application = require('../models/application');
const { getRangeFromQuery, getPreviousRange } = require('../utilities/dateRanges');
const {
  getMapAnalytics,
  getComparisonData,
  getRoleStatistics,
} = require('../services/applicationsService');
const cache = require('../utilities/cache');

function parseRolesParam(param) {
  if (!param) return null;
  if (typeof param !== 'string') {
    const err = new Error('roles must be a comma-separated string.');
    err.status = 400;
    throw err;
  }
  return param
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
}

/**
 * Get map analytics data for job applications by country
 * Supports time filtering and role filtering
 */
exports.getMapData = async (req, res, next) => {
  try {
    const range = getRangeFromQuery(req.query);
    const roles = parseRolesParam(req.query.roles);
    const { includeMetadata = false, groupByRegion = false } = req.query;

    const key = `map-analytics:${JSON.stringify({
      range,
      roles,
      includeMetadata: includeMetadata === 'true',
      groupByRegion: groupByRegion === 'true',
    })}`;

    const cached = cache.analytics.get(key);
    if (cached) return res.json(cached);

    const data = await getMapAnalytics(range, roles, {
      includeMetadata: includeMetadata === 'true',
      groupByRegion: groupByRegion === 'true',
    });

    const payload = {
      data,
      meta: {
        startDate: range.start,
        endDate: range.end,
        type: range.type,
        roles: roles || [],
        includeMetadata: includeMetadata === 'true',
        groupByRegion: groupByRegion === 'true',
      },
    };

    cache.analytics.set(key, payload);
    res.json(payload);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

/**
 * Get comparison data for percentage changes between time periods
 * Only works with preset filters (weekly, monthly, yearly)
 */
exports.getComparisonData = async (req, res, next) => {
  try {
    const currentRange = getRangeFromQuery(req.query);

    if (currentRange.type === 'custom') {
      return res.status(400).json({
        error:
          'Comparison not available for custom date ranges. Use preset filters (weekly, monthly, yearly).',
      });
    }

    const previousRange = getPreviousRange(currentRange);
    const roles = parseRolesParam(req.query.roles);

    const key = `map-comparison:${JSON.stringify({
      currentRange,
      previousRange,
      roles,
    })}`;

    const cached = cache.analytics.get(key);
    if (cached) return res.json(cached);

    const comparisonResult = await getComparisonData(currentRange, previousRange, roles);

    const payload = {
      current: {
        startDate: currentRange.start,
        endDate: currentRange.end,
        type: currentRange.type,
      },
      previous: {
        startDate: previousRange.start,
        endDate: previousRange.end,
        type: previousRange.type,
      },
      comparisonData: comparisonResult.comparisonData,
      totals: comparisonResult.totals,
      roles: roles || [],
    };

    cache.analytics.set(key, payload);
    res.json(payload);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

/**
 * Get available roles for filtering
 */
exports.getAvailableRoles = async (req, res, next) => {
  try {
    const key = 'available-roles';
    const cached = cache.static.get(key);
    if (cached) return res.json(cached);

    const roles = await Application.distinct('role');
    roles.sort();

    const payload = { roles };
    cache.static.set(key, payload);
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

/**
 * Get role statistics for the selected time period
 */
exports.getRoleStatistics = async (req, res, next) => {
  try {
    const range = getRangeFromQuery(req.query);
    const key = `role-stats:${JSON.stringify({ range })}`;

    const cached = cache.analytics.get(key);
    if (cached) return res.json(cached);

    const data = await getRoleStatistics(range);

    const payload = {
      data,
      meta: {
        startDate: range.start,
        endDate: range.end,
        type: range.type,
      },
    };

    cache.analytics.set(key, payload);
    res.json(payload);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

/**
 * Get comprehensive analytics dashboard data
 * Combines map data, comparison data, and role statistics
 */
exports.getDashboardData = async (req, res, next) => {
  try {
    const range = getRangeFromQuery(req.query);
    const roles = parseRolesParam(req.query.roles);
    const { includeComparison = true } = req.query;

    const key = `dashboard-data:${JSON.stringify({
      range,
      roles,
      includeComparison: includeComparison === 'true',
    })}`;

    const cached = cache.analytics.get(key);
    if (cached) return res.json(cached);

    // Get map data and role statistics in parallel
    const [mapData, roleStats] = await Promise.all([
      getMapAnalytics(range, roles, { includeMetadata: true }),
      getRoleStatistics(range),
    ]);

    let comparisonData = null;
    let previousRange = null;

    // Only include comparison if it's not a custom range
    if (includeComparison === 'true' && range.type !== 'custom') {
      previousRange = getPreviousRange(range);
      const comparisonResult = await getComparisonData(range, previousRange, roles);
      comparisonData = {
        comparisonData: comparisonResult.comparisonData,
        totals: comparisonResult.totals,
      };
    }

    const payload = {
      mapData,
      roleStatistics: roleStats,
      comparison: comparisonData,
      meta: {
        startDate: range.start,
        endDate: range.end,
        type: range.type,
        roles: roles || [],
        includeComparison: includeComparison === 'true',
        ...(previousRange && {
          previousRange: {
            startDate: previousRange.start,
            endDate: previousRange.end,
            type: previousRange.type,
          },
        }),
      },
    };

    cache.analytics.set(key, payload);
    res.json(payload);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

/**
 * Get country-specific analytics with detailed breakdown
 */
exports.getCountryDetails = async (req, res, next) => {
  try {
    const { country } = req.params;
    const range = getRangeFromQuery(req.query);
    const roles = parseRolesParam(req.query.roles);

    if (!country || country.length !== 3) {
      return res.status(400).json({ error: 'Country code must be a 3-letter ISO code.' });
    }

    const key = `country-details:${JSON.stringify({
      country: country.toUpperCase(),
      range,
      roles,
    })}`;

    const cached = cache.analytics.get(key);
    if (cached) return res.json(cached);

    const roleMatch = roles?.length ? { role: { $in: roles } } : {};

    const data = await Application.aggregate([
      {
        $addFields: {
          _ts: {
            $cond: [
              { $eq: [{ $type: '$timestamp' }, 'string'] },
              { $toDate: '$timestamp' },
              '$timestamp',
            ],
          },
        },
      },
      {
        $match: {
          ...roleMatch,
          country: country.toUpperCase(),
          _ts: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: null,
          totalApplicants: { $sum: '$numberOfApplicants' },
          roles: { $addToSet: '$role' },
          jobIds: { $addToSet: '$jobId' },
          applicationSources: { $addToSet: '$applicationSource' },
          avgApplicantsPerEntry: { $avg: '$numberOfApplicants' },
          countryName: { $first: '$countryName' },
          region: { $first: '$region' },
        },
      },
      {
        $project: {
          _id: 0,
          country: country.toUpperCase(),
          totalApplicants: 1,
          roles: 1,
          jobIds: 1,
          applicationSources: 1,
          avgApplicantsPerEntry: 1,
          countryName: 1,
          region: 1,
        },
      },
    ]);

    const payload = {
      data: data[0] || {
        country: country.toUpperCase(),
        totalApplicants: 0,
        roles: [],
        jobIds: [],
        applicationSources: [],
        avgApplicantsPerEntry: 0,
        countryName: null,
        region: null,
      },
      meta: {
        startDate: range.start,
        endDate: range.end,
        type: range.type,
        roles: roles || [],
      },
    };

    cache.analytics.set(key, payload);
    res.json(payload);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};
