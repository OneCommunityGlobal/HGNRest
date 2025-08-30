const express = require('express');
const router = express.Router();
const Application = require('../models/applications');
const { getPresetRange, pctChange } = require('../utilities/periods');

router.get('/', async (req, res, next) => {
  const { filter, startDate, endDate, roles } = req.query;

  const roleFilter = roles ? roles.split(',') : null;
  let currentRange = null;
  let previousRange = null;

  try {
    if (filter) {
      const range = getPresetRange(filter);
      if (!range) return res.status(400).json({ error: 'Invalid filter' });
      currentRange = range.current;
      previousRange = range.previous;
    } else if (startDate && endDate) {
      currentRange = { start: new Date(startDate), end: new Date(endDate) };
    } else {
      return res.status(400).json({ error: 'Provide either filter or startDate & endDate' });
    }

    const baseMatch = {
      ...(roleFilter && { role: { $in: roleFilter } }),
    };

    const aggregate = (range) =>
      Application.aggregate([
        { $match: { ...baseMatch, timestamp: { $gte: range.start, $lte: range.end } } },
        { $group: { _id: '$country', count: { $sum: '$numberOfApplicants' } } },
      ]);

    const currentData = await aggregate(currentRange);

    if (filter) {
      const previousData = await aggregate(previousRange);
      const prevMap = new Map(previousData.map((d) => [d._id, d.count]));

      const data = currentData.map((d) => ({
        country: d._id,
        count: d.count,
        pctChange: pctChange(d.count, prevMap.get(d._id)),
      }));

      return res.json({ mode: 'preset', filter, data });
    } else {
      const data = currentData.map((d) => ({ country: d._id, count: d.count }));
      return res.json({ mode: 'custom', startDate, endDate, data });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
