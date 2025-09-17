const express = require('express');

const router = express.Router();
const JobApplications = require('../models/JobApplications');

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, roles, granularity } = req.query;

    // -------- Build $match --------
    const match = {};
    if (startDate || endDate) {
      match.date = {
        ...(startDate ? { $gte: new Date(startDate) } : {}),
        ...(endDate ? { $lte: new Date(endDate) } : {}),
      };
    }

    if (roles && roles !== 'All') {
      const list = (Array.isArray(roles) ? roles : String(roles).replace(/[[\]]/g, '').split(','))
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length) match.role = { $in: list };
    }

    const hasDateWindow = Boolean(startDate && endDate);

    // -------- Totals path --------
    if (!hasDateWindow || !granularity) {
      const docs = await JobApplications.find(match).lean();

      const byRole = {};
      docs.forEach((d) => {
        const r = d.role;
        if (!byRole[r]) byRole[r] = { role: r, applications: 0, views: 0 };
        byRole[r].applications += d.applications || 0;
        byRole[r].views += d.views || 0;
      });

      const response = Object.values(byRole).sort(
        (a, b) => b.applications - a.applications || a.role.localeCompare(b.role),
      );

      return res.json(response);
    }

    // -------- Granular path: latest bucket per role --------
    const isWeekly = granularity === 'weekly';
    const isAnnual = granularity === 'annually';

    let unit = 'month'; // default monthly
    if (isWeekly) {
      unit = 'week';
    } else if (isAnnual) {
      unit = 'year';
    }

    const pipeline = [
      { $match: match },
      { $set: { period: { $dateTrunc: { date: '$date', unit } } } },
      {
        $group: {
          _id: { role: '$role', period: '$period' },
          role: { $first: '$role' },
          period: { $first: '$period' },
          views: { $sum: '$views' },
          applications: { $sum: '$applications' },
        },
      },
      {
        $facet: {
          buckets: [{ $project: { _id: 0, role: 1, period: 1, views: 1, applications: 1 } }],
          latestPerRole: [{ $group: { _id: '$role', latestPeriod: { $max: '$period' } } }],
        },
      },
      { $unwind: '$latestPerRole' },
      {
        $project: {
          match: {
            $filter: {
              input: '$buckets',
              as: 'b',
              cond: {
                $and: [
                  { $eq: ['$$b.role', '$latestPerRole._id'] },
                  { $eq: ['$$b.period', '$latestPerRole.latestPeriod'] },
                ],
              },
            },
          },
        },
      },
      { $unwind: '$match' },
      {
        $group: {
          _id: '$match.role',
          role: { $first: '$match.role' },
          views: { $sum: '$match.views' },
          applications: { $sum: '$match.applications' },
        },
      },
      { $project: { _id: 0, role: 1, views: 1, applications: 1 } },
      { $sort: { applications: -1, role: 1 } },
    ];

    const data = await JobApplications.aggregate(pipeline).exec();
    return res.json(data);
  } catch (err) {
    console.error('Error in job analytics route:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /job-analytics/roles
router.get('/roles', async (_req, res) => {
  try {
    const roles = await JobApplications.distinct('role');
    roles.sort((a, b) => a.localeCompare(b));
    res.json(roles);
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

module.exports = router;
