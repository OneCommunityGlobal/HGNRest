const { getMapAnalytics, getComparisonData } = require('../services/applicationsService');
const { getRangeFromQuery, getPreviousRange } = require('../utilities/dateRanges');
const cache = require('../utilities/cache');
const Application = require('../models/application');

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
 * Get country application data - Compatible with existing frontend
 * This endpoint provides data in the format expected by the frontend map component
 */
exports.getCountryApplications = async (req, res, next) => {
  try {
    // Support both 'filter' and 'timeFrame' parameters
    // Convert frontend timeFrame (WEEK, MONTH, YEAR, ALL) to backend filter format
    let { filter } = req.query;
    if (req.query.timeFrame) {
      const timeFrameMap = {
        WEEK: 'weekly',
        MONTH: 'monthly',
        YEAR: 'yearly',
        ALL: 'all',
      };
      filter = timeFrameMap[req.query.timeFrame.toUpperCase()] || 'weekly';
    }

    const query = filter ? { ...req.query, filter } : { ...req.query, filter: 'weekly' };
    const range = getRangeFromQuery(query);
    const roles = parseRolesParam(req.query.roles);

    // Include timeFrame in cache key to ensure different filters get different cached data
    const key = `country-apps:${JSON.stringify({ filter, range, roles })}`;

    const cached = cache.analytics.get(key);
    if (cached) return res.json(cached);

    // Get map data
    const mapData = await getMapAnalytics(range, roles, { includeMetadata: false });

    // Get comparison data if not custom range and if previous range exists
    let comparisonData = null;
    if (range.type !== 'custom' && range.type !== 'all') {
      const previousRange = getPreviousRange(range);
      if (previousRange) {
        const comparison = await getComparisonData(range, previousRange, roles);
        comparisonData = comparison.comparisonData;
      }
    }

    // Transform data to include percentage changes
    const enrichedData = mapData.map((item) => {
      const baseData = {
        country: item.country,
        countryName: item.countryName,
        count: item.count,
        region: item.region,
        roles: item.roles,
      };

      if (comparisonData && comparisonData[item.country]) {
        baseData.percentageChange = comparisonData[item.country].percentageChange;
        baseData.previousCount = comparisonData[item.country].previous;
      }

      return baseData;
    });

    const payload = {
      success: true,
      data: enrichedData,
      meta: {
        startDate: range.start,
        endDate: range.end,
        type: range.type,
        roles: roles || [],
        totalCountries: enrichedData.length,
        totalApplicants: enrichedData.reduce((sum, item) => sum + item.count, 0),
      },
    };

    cache.analytics.set(key, payload);
    res.json(payload);
  } catch (e) {
    console.error('Error in getCountryApplications:', e);
    if (e.status) return res.status(e.status).json({ success: false, error: e.message });
    next(e);
  }
};

/**
 * Get available roles from the database
 * This endpoint provides a list of all unique roles for the frontend dropdown
 */
exports.getAvailableRoles = async (req, res, next) => {
  try {
    const cacheKey = 'available-roles';

    // Check cache first (roles don't change often)
    const cached = cache.static.get(cacheKey);
    if (cached) return res.json(cached);

    // Get distinct roles from the database
    const roles = await Application.distinct('role');

    // Sort alphabetically
    const sortedRoles = roles.sort((a, b) => a.localeCompare(b));

    const payload = {
      success: true,
      data: sortedRoles,
      count: sortedRoles.length,
    };

    // Cache for longer since roles rarely change
    cache.static.set(cacheKey, payload);
    res.json(payload);
  } catch (e) {
    console.error('Error in getAvailableRoles:', e);
    next(e);
  }
};
