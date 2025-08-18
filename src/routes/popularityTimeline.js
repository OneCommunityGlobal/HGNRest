const express = require('express');

const router = express.Router();
const Popularity = require('../models/popularity');
const { setCache, getCache } = require('../utilities/popularityCache');

// GET: Popularity timeline data
router.get('/', async (req, res) => {
  try {
    const { range, roles, start, end } = req.query;
    const cacheKey = JSON.stringify({ range, roles, start, end });
    const cachedData = getCache(cacheKey);
    if (cachedData) return res.json(cachedData);

    const match = {};

    // Role filtering
    if (roles) {
      let parsedRoles;
      try {
        parsedRoles = JSON.parse(roles);
      } catch {
        parsedRoles = roles.split(',').map((r) => r.trim());
      }
      match.role = { $in: parsedRoles };
    }

    // Date range filtering
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      endDate.setMonth(endDate.getMonth() + 1); // Include entire end month

      match.timestamp = {
        $gte: startDate,
        $lt: endDate,
      };
    } else if (range) {
      const months = parseInt(range, 10) || 12;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      match.timestamp = { $gte: startDate };
    }

    const data = await Popularity.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$month',
          hitsCount: { $sum: '$hitsCount' },
          applicationsCount: { $sum: '$applicationsCount' },
          timestamp: { $first: '$timestamp' }, // Keep for sorting
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

    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('Error fetching popularity timeline:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Distinct roles
router.get('/roles', async (req, res) => {
  try {
    const roles = await Popularity.distinct('role');
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
