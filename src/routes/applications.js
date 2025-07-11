const express = require('express');
const router = express.Router();
const Application = require('../models/applications');
const { startOfWeek, startOfMonth, startOfYear, subDays } = require('date-fns');

const getTimeRange = (filter) => {
  const now = new Date();
  switch (filter) {
    case 'weekly':
      return { start: startOfWeek(now), end: now };
    case 'monthly':
      return { start: startOfMonth(now), end: now };
    case 'yearly':
      return { start: startOfYear(now), end: now };
    default:
      return null;
  }
};

// GET /applications?filter=weekly&roles=Developer,Manager
// OR /applications?startDate=2024-06-01&endDate=2024-07-01
router.get('/', async (req, res) => {
  const { filter, roles, startDate, endDate } = req.query;

  let timeRange;
  if (filter) {
    timeRange = getTimeRange(filter);
  } else if (startDate && endDate) {
    timeRange = {
      start: new Date(startDate),
      end: new Date(endDate),
    };
  }

  const match = {
    ...(roles && { role: { $in: roles.split(',') } }),
    ...(timeRange && {
      timestamp: {
        $gte: timeRange.start,
        $lte: timeRange.end,
      },
    }),
  };

  const applications = await Application.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$country',
        count: { $sum: '$numberOfApplicants' },
      },
    },
  ]);

  res.json(applications);
});

// GET /applications/comparison?filter=weekly&roles=Developer
router.get('/comparison', async (req, res) => {
  const { filter, roles } = req.query;
  if (!filter) return res.status(400).json({ error: 'Filter is required' });

  const now = new Date();
  const currentRange = getTimeRange(filter);

  let previousRange;
  switch (filter) {
    case 'weekly':
      previousRange = {
        start: subDays(currentRange.start, 7),
        end: currentRange.start,
      };
      break;
    case 'monthly':
      previousRange = {
        start: subDays(currentRange.start, 30),
        end: currentRange.start,
      };
      break;
    case 'yearly':
      previousRange = {
        start: subDays(currentRange.start, 365),
        end: currentRange.start,
      };
      break;
    default:
      return res.status(400).json({ error: 'Invalid filter' });
  }

  const matchCurrent = {
    ...(roles && { role: { $in: roles.split(',') } }),
    timestamp: {
      $gte: currentRange.start,
      $lte: currentRange.end,
    },
  };

  const matchPrevious = {
    ...(roles && { role: { $in: roles.split(',') } }),
    timestamp: {
      $gte: previousRange.start,
      $lte: previousRange.end,
    },
  };

  const [currentData, previousData] = await Promise.all([
    Application.aggregate([
      { $match: matchCurrent },
      { $group: { _id: '$country', count: { $sum: '$numberOfApplicants' } } },
    ]),
    Application.aggregate([
      { $match: matchPrevious },
      { $group: { _id: '$country', count: { $sum: '$numberOfApplicants' } } },
    ]),
  ]);

  const comparison = currentData.map((cur) => {
    const prev = previousData.find((p) => p._id === cur._id);
    const change = prev ? ((cur.count - prev.count) / prev.count) * 100 : null;

    return {
      country: cur._id,
      current: cur.count,
      change: change !== null ? `${change.toFixed(1)}%` : 'N/A',
    };
  });

  res.json(comparison);
});

module.exports = router;
