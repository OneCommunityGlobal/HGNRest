const moment = require('moment-timezone');
const redisCacheClosure = require('../utilities/redisCache');
const { hasPermission } = require('../utilities/permissions');
const Logger = require('../startup/logger');

const applicationAnalyticsController = function (ApplicationAnalytics) {
  const cache = redisCacheClosure();

  /**
   * Calculate date range based on filter type
   * @param {string} filter - 'weekly', 'monthly', or 'yearly'
   * @returns {Object} - { startDate, endDate }
   */
  const getDateRange = (filter) => {
    const now = moment();
    let startDate;
    let endDate;

    switch (filter) {
      case 'weekly':
        startDate = now.clone().startOf('week').toDate();
        endDate = now.clone().endOf('week').toDate();
        break;
      case 'monthly':
        startDate = now.clone().startOf('month').toDate();
        endDate = now.clone().endOf('month').toDate();
        break;
      case 'yearly':
        startDate = now.clone().startOf('year').toDate();
        endDate = now.clone().endOf('year').toDate();
        break;
      default:
        // Default to current month
        startDate = now.clone().startOf('month').toDate();
        endDate = now.clone().endOf('month').toDate();
    }

    return { startDate, endDate };
  };

  /**
   * Calculate previous period date range for comparison
   * @param {string} filter - 'weekly', 'monthly', or 'yearly'
   * @returns {Object} - { startDate, endDate }
   */
  const getPreviousPeriodRange = (filter) => {
    const now = moment();
    let startDate;
    let endDate;

    switch (filter) {
      case 'weekly':
        startDate = now.clone().subtract(1, 'week').startOf('week').toDate();
        endDate = now.clone().subtract(1, 'week').endOf('week').toDate();
        break;
      case 'monthly':
        startDate = now.clone().subtract(1, 'month').startOf('month').toDate();
        endDate = now.clone().subtract(1, 'month').endOf('month').toDate();
        break;
      case 'yearly':
        startDate = now.clone().subtract(1, 'year').startOf('year').toDate();
        endDate = now.clone().subtract(1, 'year').endOf('year').toDate();
        break;
      default:
        // Default to previous month
        startDate = now.clone().subtract(1, 'month').startOf('month').toDate();
        endDate = now.clone().subtract(1, 'month').endOf('month').toDate();
    }

    return { startDate, endDate };
  };

  /**
   * GET /applications?filter=weekly/monthly/yearly&roles=[role1,role2]
   * Fetch application data for the selected time frame with optional role filtering
   */
  const getApplications = async function (req, res) {
    try {
      // Check permissions
      if (!(await hasPermission(req.body.requestor, 'getApplicationAnalytics'))) {
        return res
          .status(403)
          .json({ error: 'You are not authorized to view application analytics' });
      }

      const { filter = 'monthly', roles, startDate, endDate } = req.query;

      // Handle custom date range filtering - this is a key frontend requirement
      const isCustomRange = startDate && endDate;

      // Parse roles if provided
      let roleFilter = {};
      if (roles) {
        try {
          const roleArray = JSON.parse(roles);
          if (Array.isArray(roleArray) && roleArray.length > 0) {
            roleFilter = { role: { $in: roleArray } };
          }
        } catch (error) {
          return res.status(400).json({ error: 'Invalid roles format. Must be a JSON array' });
        }
      }

      let dateFilter;
      let cacheKey;

      // Handle different date filtering scenarios
      if (isCustomRange) {
        // Custom date range handling
        dateFilter = {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          type: 'custom',
        };
        cacheKey = `applications:custom:${startDate}_${endDate}:${roles || 'all'}`;
      } else {
        // Preset filter handling (weekly/monthly/yearly)
        if (!['weekly', 'monthly', 'yearly'].includes(filter)) {
          return res
            .status(400)
            .json({ error: 'Invalid filter. Must be weekly, monthly, or yearly' });
        }
        dateFilter = getDateRange(filter);
        cacheKey = `applications:${filter}:${roles || 'all'}`;
      }

      // Check cache first
      if (await cache.hasCache(cacheKey)) {
        Logger.logInfo('Application analytics cache hit', { cacheKey });
        return res.status(200).json(await cache.getCache(cacheKey));
      }

      // Build query with correct date filtering
      const query = {
        timestamp: {
          $gte: dateFilter.startDate,
          $lte: dateFilter.endDate,
        },
        ...roleFilter,
      };

      // Aggregate application counts by country
      const applications = await ApplicationAnalytics.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$country',
            totalApplicants: { $sum: '$numberOfApplicants' },
            roles: { $addToSet: '$role' },
            lastUpdated: { $max: '$timestamp' },
          },
        },
        {
          $project: {
            _id: 0,
            country: '$_id',
            totalApplicants: 1,
            roles: 1,
            lastUpdated: 1,
          },
        },
        { $sort: { totalApplicants: -1 } },
      ]);

      // Enhance for map visualization - ensure country codes match standard format
      const enhancedData = applications.map((app) => ({
        country: app.country.toUpperCase(), // Ensure consistent formatting for map component
        numberOfApplicants: app.totalApplicants,
        roles: app.roles,
        lastUpdated: app.lastUpdated,
      }));

      const response = {
        data: enhancedData,
        period: {
          filter: isCustomRange ? 'custom' : filter,
          startDate: dateFilter.startDate,
          endDate: dateFilter.endDate,
          type: dateFilter.type || filter,
          supportsComparison: !isCustomRange, // Frontend requirement
        },
        summary: {
          totalCountries: applications.length,
          totalApplicants: applications.reduce((sum, app) => sum + app.totalApplicants, 0),
          // Provide metadata for map visualization
          hasData: applications.length > 0,
          periodLabel: isCustomRange
            ? `${dateFilter.startDate.toISOString().split('T')[0]} to ${dateFilter.endDate.toISOString().split('T')[0]}`
            : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Period`,
        },
      };

      // Cache the response (cache for 5 minutes for current data, longer for historical)
      const cacheTTL = filter === 'weekly' ? 300 : 1800; // 5 min for weekly, 30 min for others
      await cache.setCache(cacheKey, response, cacheTTL);

      Logger.logInfo('Application analytics data fetched', {
        filter: isCustomRange ? 'custom' : filter,
        roles: roles || 'all',
        totalCountries: applications.length,
        totalApplicants: response.totalApplicants,
      });

      return res.status(200).json(response);
    } catch (error) {
      Logger.logException(error);
      return res.status(500).json({
        error: 'Failed to fetch application data',
        details: error.message,
      });
    }
  };

  /**
   * GET /comparison?filter=weekly/monthly/yearly&roles=[role1,role2]
   * Return percentage change compared to the previous time period
   */
  const getComparison = async function (req, res) {
    try {
      // Check permissions
      if (!(await hasPermission(req.body.requestor, 'getApplicationAnalytics'))) {
        return res
          .status(403)
          .json({ error: 'You are not authorized to view application analytics' });
      }

      const { filter = 'monthly', roles, startDate, endDate } = req.query;

      // Handle custom date ranges - comparison not supported for custom dates
      const isCustomRange = startDate && endDate;

      if (isCustomRange) {
        return res.status(400).json({
          error:
            'Comparison not available for custom date ranges. Use preset filters (weekly, monthly, yearly) for comparison features.',
          details: 'This ensures accuracy of "% more than last week/month/year" calculations',
        });
      }

      // Validate filter parameter for preset filters only
      if (!['weekly', 'monthly', 'yearly'].includes(filter)) {
        return res
          .status(400)
          .json({ error: 'Invalid filter. Must be weekly, monthly, or yearly' });
      }

      // Parse roles if provided
      let roleFilter = {};
      if (roles) {
        try {
          const roleArray = JSON.parse(roles);
          if (Array.isArray(roleArray) && roleArray.length > 0) {
            roleFilter = { role: { $in: roleArray } };
          }
        } catch (error) {
          return res.status(400).json({ error: 'Invalid roles format. Must be a JSON array' });
        }
      }

      // Create cache key
      const cacheKey = `comparison:${filter}:${roles || 'all'}`;

      // Check cache first
      if (await cache.hasCache(cacheKey)) {
        Logger.logInfo('Application comparison cache hit', { cacheKey });
        return res.status(200).json(await cache.getCache(cacheKey));
      }

      // Get date ranges for current and previous periods
      const currentPeriod = getDateRange(filter);
      const previousPeriod = getPreviousPeriodRange(filter);

      // Build queries
      const currentQuery = {
        timestamp: {
          $gte: currentPeriod.startDate,
          $lte: currentPeriod.endDate,
        },
        ...roleFilter,
      };

      const previousQuery = {
        timestamp: {
          $gte: previousPeriod.startDate,
          $lte: previousPeriod.endDate,
        },
        ...roleFilter,
      };

      // Get current period data
      const currentData = await ApplicationAnalytics.aggregate([
        { $match: currentQuery },
        {
          $group: {
            _id: '$country',
            totalApplicants: { $sum: '$numberOfApplicants' },
          },
        },
        {
          $project: {
            _id: 0,
            country: '$_id',
            totalApplicants: 1,
          },
        },
      ]);

      // Get previous period data
      const previousData = await ApplicationAnalytics.aggregate([
        { $match: previousQuery },
        {
          $group: {
            _id: '$country',
            totalApplicants: { $sum: '$numberOfApplicants' },
          },
        },
        {
          $project: {
            _id: 0,
            country: '$_id',
            totalApplicants: 1,
          },
        },
      ]);

      // Create maps for easy lookup
      const currentMap = new Map(currentData.map((item) => [item.country, item.totalApplicants]));
      const previousMap = new Map(previousData.map((item) => [item.country, item.totalApplicants]));

      // Calculate percentage changes
      const comparison = [];
      const allCountries = new Set([...currentMap.keys(), ...previousMap.keys()]);

      allCountries.forEach((country) => {
        const current = currentMap.get(country) || 0;
        const previous = previousMap.get(country) || 0;

        let percentageChange = 0;
        if (previous > 0) {
          percentageChange = ((current - previous) / previous) * 100;
        } else if (current > 0) {
          percentageChange = 100; // New country with applications
        }

        let trend = 'stable';
        if (percentageChange > 0) {
          trend = 'up';
        } else if (percentageChange < 0) {
          trend = 'down';
        }

        comparison.push({
          country,
          currentApplicants: current,
          previousApplicants: previous,
          change: current - previous,
          percentageChange: Math.round(percentageChange * 100) / 100, // Round to 2 decimal places
          trend,
        });
      });

      // Sort by percentage change (highest first)
      comparison.sort((a, b) => b.percentageChange - a.percentageChange);

      const response = {
        data: comparison,
        periods: {
          current: {
            filter,
            startDate: currentPeriod.startDate,
            endDate: currentPeriod.endDate,
          },
          previous: {
            filter,
            startDate: previousPeriod.startDate,
            endDate: previousPeriod.endDate,
          },
        },
        summary: {
          totalCountries: comparison.length,
          countriesWithGrowth: comparison.filter((c) => c.trend === 'up').length,
          countriesWithDecline: comparison.filter((c) => c.trend === 'down').length,
          countriesStable: comparison.filter((c) => c.trend === 'stable').length,
          averageChange:
            comparison.length > 0
              ? Math.round(
                  (comparison.reduce((sum, c) => sum + c.percentageChange, 0) / comparison.length) *
                    100,
                ) / 100
              : 0,
        },
      };

      // Cache the response (cache for 10 minutes)
      await cache.setCache(cacheKey, response, 600);

      Logger.logInfo('Application comparison data fetched', {
        filter,
        roles: roles || 'all',
        totalCountries: comparison.length,
        averageChange: response.summary.averageChange,
      });

      return res.status(200).json(response);
    } catch (error) {
      Logger.logException(error);
      return res.status(500).json({
        error: 'Failed to fetch comparison data',
        details: error.message,
      });
    }
  };

  /**
   * POST /applications
   * Create or update application analytics data
   */
  const createApplicationData = async function (req, res) {
    try {
      // Check permissions
      if (!(await hasPermission(req.body.requestor, 'postApplicationAnalytics'))) {
        return res
          .status(403)
          .json({ error: 'You are not authorized to create application analytics data' });
      }

      const { country, numberOfApplicants, role, timestamp } = req.body;

      // Validate required fields
      if (!country || numberOfApplicants === undefined || !role) {
        return res.status(400).json({
          error: 'Missing required fields: country, numberOfApplicants, and role are required',
        });
      }

      // Validate country code format (ISO 3166-1 alpha-2)
      if (!/^[A-Z]{2}$/.test(country)) {
        return res.status(400).json({
          error: 'Invalid country code. Must be a 2-letter ISO country code (e.g., US, CA, GB)',
        });
      }

      // Validate numberOfApplicants
      if (typeof numberOfApplicants !== 'number' || numberOfApplicants < 0) {
        return res.status(400).json({
          error: 'numberOfApplicants must be a non-negative number',
        });
      }

      // Create new application analytics entry
      const applicationData = new ApplicationAnalytics({
        country: country.toUpperCase(),
        numberOfApplicants,
        role,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      });

      await applicationData.save();

      // Invalidate relevant caches
      const cacheKeys = [
        'applications:weekly:all',
        'applications:monthly:all',
        'applications:yearly:all',
        'comparison:weekly:all',
        'comparison:monthly:all',
        'comparison:yearly:all',
      ];

      // Remove specific keys
      await Promise.all(cacheKeys.map((key) => cache.removeCache(key)));

      // Also remove any role-specific caches
      await cache.removeCachePattern('applications:*');
      await cache.removeCachePattern('comparison:*');

      Logger.logInfo('Application analytics data created', {
        country,
        numberOfApplicants,
        role,
        timestamp: applicationData.timestamp,
      });

      return res.status(201).json({
        message: 'Application analytics data created successfully',
        data: applicationData,
      });
    } catch (error) {
      Logger.logException(error);
      return res.status(500).json({
        error: 'Failed to create application analytics data',
        details: error.message,
      });
    }
  };

  /**
   * GET /roles
   * Get all available roles for filtering (frontend requirement)
   */
  const getAvailableRoles = async function (req, res) {
    try {
      // Check permissions
      if (!(await hasPermission(req.body.requestor, 'getApplicationAnalytics'))) {
        return res
          .status(403)
          .json({ error: 'You are not authorized to view application analytics' });
      }

      // Create cache key
      const cacheKey = 'application-analytics-roles';

      // Check cache first
      if (await cache.hasCache(cacheKey)) {
        Logger.logInfo('Application roles cache hit', { cacheKey });
        return res.status(200).json(await cache.getCache(cacheKey));
      }

      // Get all unique roles
      const roles = await ApplicationAnalytics.distinct('role');
      roles.sort(); // Sort alphabetically for UI

      const response = {
        roles,
        count: roles.length,
      };

      // Cache for 1 hour (roles change infrequently)
      await cache.setCache(cacheKey, response, 3600);

      Logger.logInfo('Application analytics roles fetched', {
        totalRoles: roles.length,
        roles,
      });

      return res.status(200).json(response);
    } catch (error) {
      Logger.logException(error);
      return res.status(500).json({
        error: 'Failed to fetch available roles',
        details: error.message,
      });
    }
  };

  return {
    getApplications,
    getComparison,
    createApplicationData,
    getAvailableRoles,
  };
};

module.exports = applicationAnalyticsController;
