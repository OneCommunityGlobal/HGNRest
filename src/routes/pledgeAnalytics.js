const express = require('express');

const router = express.Router();
const RolePledges = require('../models/rolePledge');

router.get('/months-pledged', async (req, res) => {
  try {
    const { startDate, endDate, roles } = req.query;

    // Build query object with optional filters
    const query = {};

    if (startDate || endDate) {
      query.pledgeDate = {};
      if (startDate) query.pledgeDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.pledgeDate.$lte = end;
      }
    }

    if (roles) {
      // roles expected as comma separated string, e.g. ?roles=Engineer,Designer
      const rolesArray = roles.split(',').map((r) => r.trim());
      query.role = { $in: rolesArray };
    }

    // Use MongoDB aggregation to group by role and calculate avg months pledged
    const aggregation = [
      { $match: query },
      {
        $group: {
          _id: '$role',
          avgMonthsPledged: { $avg: '$monthsPledged' },
        },
      },
      {
        $project: {
          _id: 0,
          role: '$_id',
          avgMonthsPledged: { $round: ['$avgMonthsPledged', 2] },
        },
      },
      { $sort: { avgMonthsPledged: -1 } }, // sort descending
    ];

    const results = await RolePledges.aggregate(aggregation);

    res.json(results);
  } catch (error) {
    console.error('Error fetching average months pledged:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
