// src/routes/popularityEnhancedRoutes.js
const express = require('express');

const router = express.Router();
const PopularityEnhanced = require('../models/popularityEnhanced');
const EnhancedPopularityCache = require('../utilities/popularityEnhancedCache');

/**
 * Enhanced Popularity Timeline Routes
 * Version: 2.1 - Fixed role filtering and data structure
 */

// GET: Enhanced popularity timeline with role-based grouping
router.get('/timeline', async (req, res) => {
  try {
    const { range, roles, start, end, groupByRole = 'true', includeLowVolume = 'true' } = req.query;

    console.log('Timeline query params:', {
      range,
      roles,
      start,
      end,
      groupByRole,
      includeLowVolume,
    });

    // Generate cache key based on all parameters
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

    const match = { isActive: true };

    // Enhanced role filtering with partial matching
    if (roles && roles !== 'All Roles' && roles !== '["All Roles"]') {
      let parsedRoles;
      try {
        // Handle both JSON array and comma-separated string
        parsedRoles = JSON.parse(roles);
      } catch {
        parsedRoles = roles.split(',').map((r) => r.trim().replace(/"/g, ''));
      }

      console.log('Parsed roles for filtering:', parsedRoles);

      if (parsedRoles.length > 0 && !parsedRoles.includes('All Roles')) {
        // Create regex patterns for partial matching
        const rolePatterns = parsedRoles.map((role) => new RegExp(role, 'i'));
        match.role = { $in: rolePatterns };
      }
    }

    // Enhanced date range handling
    if (start && end) {
      const [startYear, startMonth] = start.split('-').map(Number);
      const [endYear, endMonth] = end.split('-').map(Number);

      const startDate = new Date(startYear, startMonth - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(endYear, endMonth, 0, 23, 59, 59, 999);

      match.timestamp = { $gte: startDate, $lte: endDate };
    } else if (range) {
      const months = parseInt(range, 10) || 12;
      // const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Instead of filtering by timestamp, filter by month strings for demo data
      const monthStrings = [];
      for (let i = 0; i < months; i += 1) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        monthStrings.push(`${year}-${month}`);
      }

      if (months <= 6) {
        // For shorter ranges, use the last N months from our available data
        const availableMonths = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'];
        const recentMonths = availableMonths.slice(-months);
        match.month = { $in: recentMonths };
      } else {
        // For longer ranges, just use all available data
        console.log(`Using all available data for ${months} month range (demo mode)`);
      }
    }

    // Low volume filtering
    if (includeLowVolume === 'false') {
      match.hitsCount = { $gte: 10 };
    }

    console.log('MongoDB match query:', JSON.stringify(match, null, 2));

    let result;

    if (groupByRole === 'true') {
      // Enhanced role-based aggregation for pairing
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
                dataPoints: '$dataPoints',
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
              popularityScore: {
                $multiply: ['$totalHits', { $add: [1, '$avgConversionRate'] }],
              },
            },
          },
        },
        { $sort: { 'summary.popularityScore': -1 } },
      ]);

      // Sort each role's data by timestamp
      result.forEach((roleGroup) => {
        roleGroup.data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      });
    } else {
      // Fallback to simple aggregation (compatible with old frontend)
      result = await PopularityEnhanced.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$month',
            hitsCount: { $sum: '$hitsCount' },
            applicationsCount: { $sum: '$applicationsCount' },
            timestamp: { $first: '$timestamp' },
          },
        },
        {
          $project: {
            _id: 0,
            month: '$_id',
            hitsCount: 1,
            applicationsCount: 1,
            timestamp: 1,
          },
        },
        { $sort: { timestamp: 1 } },
      ]);
    }

    console.log(`Query returned ${result.length} role groups`);

    // Cache the result
    EnhancedPopularityCache.set(cacheKey, result);

    res.json({
      success: true,
      data: result,
      cached: false,
      timestamp: new Date().toISOString(),
      recordCount: Array.isArray(result) ? result.length : 0,
    });
  } catch (error) {
    console.error('Error in enhanced popularity timeline:', error);
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

    console.log('Role pairs query params:', { roles, start, end });

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

    console.log('Parsed roles for pairs:', parsedRoles);

    // Use regex for partial matching of role names
    const rolePatterns = parsedRoles.map((role) => new RegExp(role, 'i'));

    const match = {
      role: { $in: rolePatterns },
      isActive: true,
    };

    // Date filtering
    if (start && end) {
      const [startYear, startMonth] = start.split('-').map(Number);
      const [endYear, endMonth] = end.split('-').map(Number);
      const startDate = new Date(startYear, startMonth - 1, 1);
      const endDate = new Date(endYear, endMonth, 0, 23, 59, 59, 999);
      match.timestamp = { $gte: startDate, $lte: endDate };
    }

    console.log('Role pairs match query:', JSON.stringify(match, null, 2));

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

    console.log(`Role pairs query returned ${rolePairs.length} months of data`);

    EnhancedPopularityCache.set(cacheKey, rolePairs);

    res.json({
      success: true,
      data: rolePairs,
      cached: false,
      roleCount: parsedRoles.length,
      monthsCount: rolePairs.length,
    });
  } catch (error) {
    console.error('Error fetching role pairs:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching role pairs',
      details: error.message,
    });
  }
});

module.exports = router;
