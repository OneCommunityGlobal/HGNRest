const InjuryCategory = require('../../models/bmdashboard/buildingInjury');
const { buildMatch } = require('./injuryCategoryController');

const parseDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
};

// Read-only analysis of recorded counts. No exposure/workforce data is available.
exports.getCategoryAnalysis = async (req, res) => {
  const { startDate, endDate, interval = 'monthly', projectIds = '' } = req.query;
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || start > end || end - start > 3660 * 86400000) {
    return res
      .status(400)
      .json({ error: 'Choose a valid date range of at most 10 years (YYYY-MM-DD).' });
  }
  if (!['monthly', 'quarterly'].includes(interval)) {
    return res.status(400).json({ error: 'Interval must be monthly or quarterly.' });
  }
  if (
    String(projectIds)
      .split(',')
      .filter(Boolean)
      .some((id) => !/^[a-f\d]{24}$/i.test(id.trim()))
  ) {
    return res.status(400).json({ error: 'Invalid project ID.' });
  }
  try {
    const { match } = buildMatch(req.query);
    const records = await InjuryCategory.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            workerCategory: '$workerCategory',
            severity: '$severity',
          },
          count: { $sum: { $ifNull: ['$count', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          workerCategory: '$_id.workerCategory',
          severity: '$_id.severity',
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1, workerCategory: 1, severity: 1 } },
    ]).option({ allowDiskUse: true });

    const step = interval === 'quarterly' ? 3 : 1;
    const firstMonth = Math.floor(start.getUTCMonth() / step) * step;
    const buckets = [];
    for (
      const cursor = new Date(Date.UTC(start.getUTCFullYear(), firstMonth, 1));
      cursor <= end;
      cursor.setUTCMonth(cursor.getUTCMonth() + step)
    ) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      buckets.push({
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        label:
          step === 3
            ? `Q${Math.floor(month / 3) + 1} ${year}`
            : cursor.toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              }),
        records: [],
      });
    }
    const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    for (const record of records) {
      const month = Math.floor((record.month - 1) / step) * step + 1;
      const bucket = bucketByKey.get(`${record.year}-${String(month).padStart(2, '0')}`);
      if (bucket)
        bucket.records.push({
          workerCategory: record.workerCategory || 'Unknown',
          severity: record.severity || 'Unknown',
          count: record.count,
        });
    }
    return res.json({
      startDate,
      endDate,
      interval,
      days: Math.round((end - start) / 86400000) + 1,
      buckets,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to load injury category analysis.' });
  }
};
