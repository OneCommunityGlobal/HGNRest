const express = require('express');

const router = express.Router();
const Popularity = require('../models/popularity');
const { setCache, getCache } = require('../utilities/popularityCache');

router.get('/', async (req, res) => {
  try {
    const { range, roles, start, end } = req.query;

    // Create a cache key based on query params
    const cacheKey = JSON.stringify({ range, roles, start, end });
    const cachedData = getCache(cacheKey);
    if (cachedData) return res.json(cachedData);

    const match = {};

    // --- Roles parsing ---
    if (roles) {
      let parsedRoles;
      try {
        parsedRoles = JSON.parse(roles);
      } catch {
        parsedRoles = roles
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((r) => r.trim().replace(/^"|"$/g, ''));
      }
      match.role = { $in: parsedRoles };
    }

    const now = new Date();

    // --- Range filter ---
    if (range && !start && !end) {
      const monthsToFetch = parseInt(range.replace('months', ''), 10) || 12;
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - monthsToFetch);
      match.timestamp = { $gte: startDate };
    }

    // --- Start/End filter ---
    if (start && end) {
      match.timestamp = {
        $gte: new Date(`${start}-01`),
        $lte: new Date(`${end}-31`),
      };
    }

    // --- Aggregation ---
    const data = await Popularity.aggregate([
      { $match: match },
      {
        $group: {
          _id: { month: '$month', role: '$role' },
          hitsCount: { $sum: '$hitsCount' },
          applicationsCount: { $sum: '$applicationsCount' },
        },
      },
      { $sort: { '_id.month': 1 } },
    ]);

    const formattedData = data.map((d) => ({
      month: d._id.month,
      role: d._id.role,
      hitsCount: d.hitsCount,
      applicationsCount: d.applicationsCount,
    }));

    // --- Save result in cache ---
    setCache(cacheKey, formattedData);

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching popularity timeline:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
