const mongoose = require('mongoose');
const InjuryCategory = require('../../models/bmdashboard/buildingInjury');

// ---------- helpers ----------
const parseCSV = (s = '') =>
  String(s)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseYmdUtc = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, 0, 0, 0, 0));
};

const parseDateFlexibleUTC = (s) => {
  const d1 = parseYmdUtc(s);
  if (d1) return d1;
  if (!s) return null;
  const d2 = new Date(s);
  return Number.isNaN(d2.getTime()) ? null : d2;
};

const parseObjectIdsCSV = (s = '') =>
  parseCSV(s)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

const buildMatch = ({
  projectIds,
  startDate,
  endDate,
  severities,
  types,
  projectNames,
  projectName,
}) => {
  const match = {};

  const ids = parseObjectIdsCSV(projectIds);
  if (ids.length) match.projectId = { $in: ids };

  const s = parseDateFlexibleUTC(startDate);
  const e0 = parseDateFlexibleUTC(endDate);
  if (s || e0) {
    match.date = {};
    if (s) match.date.$gte = s;
    if (e0) {
      if (parseYmdUtc(endDate)) {
        const endExclusive = new Date(e0);
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
        match.date.$lt = endExclusive;
      } else {
        match.date.$lte = e0;
      }
    }
  }

  const sev = parseCSV(severities);
  if (sev.length) match.severity = { $in: sev };

  const typ = parseCSV(types);
  if (typ.length) match.injuryType = { $in: typ };

  const names = parseCSV(projectNames || projectName);
  if (names.length) {
    match.$or = names.map((n) => ({ projectName: { $regex: new RegExp(escapeRe(n), 'i') } }));
  }

  const invalidDate =
    (startDate && !s && !parseYmdUtc(startDate)) || (endDate && !e0 && !parseYmdUtc(endDate));
  return { match, invalidDate };
};

// ---------- controllers ----------
exports.getCategoryBreakdown = async (req, res) => {
  try {
    const { match, invalidDate } = buildMatch(req.query);
    if (invalidDate)
      return res
        .status(400)
        .json({ error: 'Invalid startDate or endDate (use YYYY-MM-DD or ISO)' });

    const results = await InjuryCategory.aggregate([
      { $match: match },
      { $addFields: { _nameTrim: { $trim: { input: { $ifNull: ['$projectName', ''] } } } } },
      {
        $group: {
          _id: {
            projectId: '$projectId',
            workerCategory: '$workerCategory',
            projectName: '$_nameTrim',
          },
          totalInjuries: { $sum: { $ifNull: ['$count', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          projectId: '$_id.projectId',
          workerCategory: '$_id.workerCategory',
          projectName: '$_id.projectName',
          totalInjuries: 1,
        },
      },
      { $sort: { workerCategory: 1, projectName: 1 } },
    ]).option({ allowDiskUse: true });

    res.status(200).json(results);
  } catch (err) {
    console.error('[getCategoryBreakdown] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getUniqueSeverities = async (_req, res) => {
  try {
    const severities = await InjuryCategory.distinct('severity');
    res.status(200).json(severities.filter(Boolean).sort());
  } catch (err) {
    console.error('[getUniqueSeverities] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getUniqueInjuryTypes = async (_req, res) => {
  try {
    const types = await InjuryCategory.distinct('injuryType');
    res.status(200).json(types.filter(Boolean).sort());
  } catch (err) {
    console.error('[getUniqueInjuryTypes] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getProjectsWithInjuries = async (req, res) => {
  try {
    const { match, invalidDate } = buildMatch(req.query);
    if (invalidDate)
      return res
        .status(400)
        .json({ error: 'Invalid startDate or endDate (use YYYY-MM-DD or ISO)' });

    const projects = await InjuryCategory.aggregate([
      { $match: match },
      { $addFields: { _nameTrim: { $trim: { input: { $ifNull: ['$projectName', ''] } } } } },
      { $group: { _id: '$projectId', names: { $addToSet: '$_nameTrim' } } },
      {
        $project: {
          _id: 1,
          name: {
            $first: {
              $filter: {
                input: { $sortArray: { input: '$names', sortBy: 1 } },
                as: 'n',
                cond: { $ne: ['$$n', ''] },
              },
            },
          },
        },
      },
      { $match: { name: { $type: 'string', $ne: '' } } },
      { $sort: { name: 1 } },
    ]).option({ allowDiskUse: true });

    res.status(200).json(projects);
  } catch (err) {
    console.error('[getProjectsWithInjuries] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Returns monthly injury counts per severity between startDate and endDate for an optional projectId
// Response shape:
// {
//   months: ['Jan', 'Feb', ...],
//   serious: [..],
//   medium: [..],
//   low: [..]
// }
exports.getInjuryTrendData = async (req, res) => {
  try {
    const { projectId, startDate, endDate } = req.query || {};

    // Build match using existing helpers for date parsing/validation
    const { match, invalidDate } = buildMatch({ projectIds: projectId, startDate, endDate });
    if (invalidDate)
      return res
        .status(400)
        .json({ error: 'Invalid startDate or endDate (use YYYY-MM-DD or ISO)' });

    // Defaults: last 12 months if no range provided
    const now = new Date();
    const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const defaultStart = new Date(
      Date.UTC(defaultEnd.getUTCFullYear(), defaultEnd.getUTCMonth() - 11, 1, 0, 0, 0, 0),
    );

    const start = match.date?.$gte || defaultStart;
    const endExclusive =
      match.date?.$lt ||
      new Date(Date.UTC(defaultEnd.getUTCFullYear(), defaultEnd.getUTCMonth() + 1, 1, 0, 0, 0, 0));

    // Ensure match uses our computed range bounds
    match.date = { $gte: start, $lt: endExclusive };

    // Aggregate by year-month and severity
    const agg = await InjuryCategory.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            y: { $year: '$date' },
            m: { $month: '$date' },
            s: '$severity',
          },
          c: { $sum: { $ifNull: ['$count', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          year: '$_id.y',
          month: '$_id.m',
          severity: '$_id.s',
          count: '$c',
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]).option({ allowDiskUse: true });

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // Build ordered list of months from start..endExclusive stepping by 1 month
    const labels = [];
    const monthKeys = [];
    {
      const d = new Date(start);
      while (d < endExclusive) {
        labels.push(monthNames[d.getUTCMonth()]);
        monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
        d.setUTCMonth(d.getUTCMonth() + 1);
      }
    }

    // Map of key(year-month)->severity->count
    const map = new Map();
    agg.forEach((r) => {
      const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, {});
      const m2 = map.get(key);
      const sev = String(r.severity || '').toLowerCase();
      m2[sev] = (m2[sev] || 0) + (Number(r.count) || 0);
    });

    const seriesSerious = [];
    const seriesMedium = [];
    const seriesLow = [];
    monthKeys.forEach((k) => {
      const entry = map.get(k) || {};
      seriesSerious.push(entry.serious || 0);
      seriesMedium.push(entry.medium || 0);
      seriesLow.push(entry.low || 0);
    });

    res
      .status(200)
      .json({ months: labels, serious: seriesSerious, medium: seriesMedium, low: seriesLow });
  } catch (err) {
    console.error('[getInjuryTrendData] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create injury records (production)
exports.createInjuries = async (req, res) => {
  try {
    const body = Array.isArray(req.body) ? req.body : [req.body];
    if (!body.length) return res.status(400).json({ error: 'Empty payload' });

    const allowedSeverity = new Map([
      ['serious', 'Serious'],
      ['medium', 'Medium'],
      ['low', 'Low'],
    ]);

    const normalize = (x = {}) => {
      const { projectId, projectName, date, injuryType, workerCategory, severity, count } = x;

      if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error('projectId is required and must be a valid ObjectId');
      }

      const d = parseDateFlexibleUTC(date);
      if (!d) throw new Error('Invalid or missing date (use YYYY-MM-DD or ISO)');

      const sevNorm = allowedSeverity.get(
        String(severity || '')
          .trim()
          .toLowerCase(),
      );
      if (!sevNorm) throw new Error('severity must be one of: Serious | Medium | Low');

      return {
        projectId: new mongoose.Types.ObjectId(projectId),
        projectName: projectName ? String(projectName) : undefined,
        date: d,
        injuryType: injuryType ? String(injuryType) : undefined,
        workerCategory: workerCategory ? String(workerCategory) : undefined,
        severity: sevNorm,
        count: Number(count ?? 1),
      };
    };

    const docs = body.map(normalize);
    const result = await InjuryCategory.insertMany(docs, { ordered: false });
    return res.status(201).json({ insertedCount: result.length, docs: result });
  } catch (err) {
    const msg = err?.message || 'Failed to create injuries';
    console.error('[createInjuries] Error:', err);
    // 400 for validation, 500 for others
    if (/required|invalid|must be/i.test(msg)) return res.status(400).json({ error: msg });
    return res.status(500).json({ error: 'Internal server error' });
  }
};
