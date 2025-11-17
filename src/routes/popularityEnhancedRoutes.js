const express = require('express');

const router = express.Router();
const PopularityEnhanced = require('../models/popularityEnhanced');
const EnhancedPopularityCache = require('../utilities/popularityEnhancedCache');

/**
 * Enhanced Popularity Timeline Routes
 */

// GET: Enhanced popularity timeline with role-based grouping
router.get('/timeline', async (req, res) => {
  try {
    // Setting default for groupByRole to 'true' as this is the enhanced endpoint
    const { range, roles, start, end, groupByRole = 'true', includeLowVolume = 'true' } = req.query;

    const cacheKey = `enhanced_timeline_${JSON.stringify({ range, roles, start, end, groupByRole, includeLowVolume })}`;

    const cachedData = EnhancedPopularityCache.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    const match = { isActive: true }; // Enhanced role filtering with partial matching

    if (roles && roles !== 'All Roles' && roles !== '["All Roles"]') {
      let parsedRoles;
      try {
        // Handle both JSON array and comma-separated string
        parsedRoles = JSON.parse(roles);
      } catch {
        parsedRoles = roles.split(',').map((r) => r.trim().replace(/"/g, ''));
      }

      if (parsedRoles.length > 0 && !parsedRoles.includes('All Roles')) {
        // Create regex patterns for partial matching
        const rolePatterns = parsedRoles.map((role) => new RegExp(role, 'i'));
        match.role = { $in: rolePatterns };
      }
    } // Enhanced date range handling

    if (start && end) {
      const [startYear, startMonth] = start.split('-').map(Number);
      const [endYear, endMonth] = end.split('-').map(Number);

      const startDate = new Date(startYear, startMonth - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(endYear, endMonth, 0, 23, 59, 59, 999);

      match.timestamp = { $gte: startDate, $lte: endDate };
    } else if (range) {
      const months = parseInt(range, 10) || 12;

      if (months <= 6) {
        const availableMonths = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'];
        const recentMonths = availableMonths.slice(-months);
        match.month = { $in: recentMonths };
      }
    }

    if (includeLowVolume === 'false') {
      match.hitsCount = { $gte: 10 };
    }

    let result; // We always run the role-based aggregation as this is the enhanced endpoint

    if (groupByRole === 'true') {
      // Role-based aggregation for timeline data (Supports the UX requirement for multiple lines)
      result = await PopularityEnhanced.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              role: '$role',
              month: '$month',
            },
            hitsCount: { $sum: '$hitsCount' },
            applicationsCount: { $sum: '$applicationsCount' },
            timestamp: { $first: '$timestamp' },
            dataPoints: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.role',
            roleData: {
              $push: {
                month: '$_id.month',
                hitsCount: '$hitsCount',
                applicationsCount: '$applicationsCount',
                timestamp: '$timestamp',
              },
            },
            totalHits: { $sum: '$hitsCount' },
            totalApplications: { $sum: '$applicationsCount' },
            avgConversionRate: {
              $avg: {
                $cond: [
                  { $eq: ['$hitsCount', 0] },
                  0,
                  { $divide: ['$applicationsCount', '$hitsCount'] },
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            role: '$_id',
            data: {
              $map: {
                input: '$roleData',
                as: 'item',
                in: {
                  month: '$$item.month',
                  hitsCount: '$$item.hitsCount',
                  applicationsCount: '$$item.applicationsCount',
                  timestamp: '$$item.timestamp',
                  conversionRate: {
                    $cond: [
                      { $eq: ['$$item.hitsCount', 0] },
                      0,
                      { $divide: ['$$item.applicationsCount', '$$item.hitsCount'] },
                    ],
                  },
                },
              },
            },
            summary: {
              totalHits: '$totalHits',
              totalApplications: '$totalApplications',
              avgConversionRate: { $round: ['$avgConversionRate', 4] },
              popularityScore: { $multiply: ['$totalHits', { $add: [1, '$avgConversionRate'] }] },
            },
          },
        },
        { $sort: { 'summary.popularityScore': -1 } },
      ]); // Sort each role's data by timestamp for correct line plotting order

      result.forEach((roleGroup) => {
        roleGroup.data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'This endpoint only supports role-grouped aggregation (groupByRole=true)',
      });
    } // Cache the result

    EnhancedPopularityCache.set(cacheKey, result);

    res.json({
      success: true,
      data: result,
      cached: false,
      timestamp: new Date().toISOString(),
      recordCount: Array.isArray(result) ? result.length : 0,
    });
  } catch (error) {
    console.error('Error fetching enhanced popularity data:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error fetching enhanced popularity data',
      details: error.message,
    });
  }
});

// GET: Role pairing data for connected visualization
router.get('/role-pairs', async (req, res) => {
  try {
    const { roles, start, end } = req.query;

    if (!roles || roles === 'All Roles' || roles === '["All Roles"]') {
      return res.status(400).json({
        success: false,
        error: 'Specific roles required for pairing endpoint',
      });
    }

    const cacheKey = `role_pairs_${roles}_${start}_${end}`;
    const cachedData = EnhancedPopularityCache.get(cacheKey);
    if (cachedData) return res.json({ success: true, data: cachedData, cached: true });

    let parsedRoles;
    try {
      parsedRoles = JSON.parse(roles);
    } catch {
      parsedRoles = roles.split(',').map((r) => r.trim().replace(/"/g, ''));
    }

    const rolePatterns = parsedRoles.map((role) => new RegExp(role, 'i'));

    const match = {
      role: { $in: rolePatterns },
      isActive: true,
    }; // Date filtering

    if (start && end) {
      const [startYear, startMonth] = start.split('-').map(Number);
      const [endYear, endMonth] = end.split('-').map(Number);
      const startDate = new Date(startYear, startMonth - 1, 1);
      const endDate = new Date(endYear, endMonth, 0, 23, 59, 59, 999);
      match.timestamp = { $gte: startDate, $lte: endDate };
    }

    const rolePairs = await PopularityEnhanced.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            role: '$role',
            month: '$month',
          },
          hitsCount: { $sum: '$hitsCount' },
          applicationsCount: { $sum: '$applicationsCount' },
          timestamp: { $first: '$timestamp' },
        },
      },
      {
        $group: {
          _id: '$_id.month',
          roles: {
            $push: {
              role: '$_id.role',
              hitsCount: '$hitsCount',
              applicationsCount: '$applicationsCount',
              pairId: { $concat: ['$_id.role', '_', '$_id.month'] },
            },
          },
          totalHits: { $sum: '$hitsCount' },
          totalApplications: { $sum: '$applicationsCount' },
          timestamp: { $first: '$timestamp' },
        },
      },
      {
        $project: {
          _id: 0,
          month: '$_id',
          roles: 1,
          totalHits: 1,
          totalApplications: 1,
          timestamp: 1,
          roleCount: { $size: '$roles' },
        },
      },
      { $sort: { timestamp: 1 } },
    ]);

    EnhancedPopularityCache.set(cacheKey, rolePairs);

    res.json({
      success: true,
      data: rolePairs,
      cached: false,
      roleCount: parsedRoles.length,
      monthsCount: rolePairs.length,
    });
  } catch (error) {
    console.error('Error fetching role pairs:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error fetching role pairs',
      details: error.message,
    });
  }
});

// GET: Role list with aggregated summaries (for filter dropdown)
router.get('/roles-enhanced', async (req, res) => {
  try {
    const cacheKey = 'enhanced_roles_analytics';
    const cachedData = EnhancedPopularityCache.get(cacheKey);

    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
      });
    }

    const roles = await PopularityEnhanced.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$role',
          totalHits: { $sum: '$hitsCount' },
          totalApplications: { $sum: '$applicationsCount' },
          lastActivity: { $max: '$timestamp' },
          dataPointCount: { $sum: 1 },
          monthsActive: { $addToSet: '$month' },
        },
      },
      {
        $project: {
          _id: 0,
          role: '$_id',
          totalHits: 1,
          totalApplications: 1,
          lastActivity: 1,
          dataPointCount: 1,
          monthsActive: { $size: '$monthsActive' },
          conversionRate: {
            $cond: [
              { $eq: ['$totalHits', 0] },
              0,
              { $divide: ['$totalApplications', '$totalHits'] },
            ],
          },
          popularityScore: {
            $multiply: ['$totalHits', { $add: [1, { $ifNull: ['$conversionRate', 0] }] }],
          },
          activityLevel: {
            $switch: {
              branches: [
                { case: { $gte: ['$totalHits', 1000] }, then: 'High' },
                { case: { $gte: ['$totalHits', 100] }, then: 'Medium' },
              ],
              default: 'Low',
            },
          },
        },
      },
      { $sort: { popularityScore: -1 } },
    ]);

    const allRolesSummary = {
      role: 'All Roles',
      totalHits: roles.reduce((sum, r) => sum + r.totalHits, 0),
      totalApplications: roles.reduce((sum, r) => sum + r.totalApplications, 0),
      lastActivity: new Date(Math.max(...roles.map((r) => new Date(r.lastActivity)))),
      dataPointCount: roles.reduce((sum, r) => sum + r.dataPointCount, 0),
      monthsActive: new Set(roles.flatMap((r) => r.monthsActive)).size,
      conversionRate: 0,
      popularityScore: 0,
      activityLevel: 'All',
    };

    if (allRolesSummary.totalHits > 0) {
      allRolesSummary.conversionRate =
        allRolesSummary.totalApplications / allRolesSummary.totalHits;
      allRolesSummary.popularityScore =
        allRolesSummary.totalHits * (1 + allRolesSummary.conversionRate);
    }

    const enhancedRoles = [allRolesSummary, ...roles];

    EnhancedPopularityCache.set(cacheKey, enhancedRoles, 15 * 60 * 1000); // 15 minutes

    res.json({
      success: true,
      data: enhancedRoles,
      cached: false,
      totalRoles: enhancedRoles.length,
    });
  } catch (error) {
    console.error('Error fetching enhanced roles:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error fetching enhanced roles',
    });
  }
});

module.exports = router;
