const express = require('express');
const router = express.Router();
const JobPosting = require('../models/jobPosting');

// Utility to get grouping format
const getGroupFormat = (granularity) => {
  switch (granularity) {
    case 'weekly':
      return { $week: { $toDate: '$datePosted' } };
    case 'monthly':
      return { $month: { $toDate: '$datePosted' } };
    case 'annual':
      return { $year: { $toDate: '$datePosted' } };
    default:
      return null;
  }
};

router.get('/', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      roles,
      granularity = 'monthly',
      metric = 'applications',
    } = req.query;

    const match = {};

    if (startDate && endDate) {
      match.datePosted = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (roles) {
      const roleArray = roles.split(',').map((role) => role.trim());
      match.title = { $in: roleArray };
    }

    const groupPeriod = getGroupFormat(granularity);

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            title: '$title',
            ...(groupPeriod && { period: groupPeriod }),
          },
          [metric]: { $sum: `$${metric}` }, // Dynamic metric (applications or hits)
        },
      },
      {
        $project: {
          _id: 0,
          role: '$_id.title',
          period: '$_id.period',
          [metric]: 1,
        },
      },
      { $sort: { [metric]: -1 } },
    ];

    const data = await JobPosting.aggregate(pipeline);
    res.status(200).json(data);
  } catch (err) {
    console.error('Job Analytics Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
