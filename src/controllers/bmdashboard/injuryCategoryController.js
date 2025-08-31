/* eslint-disable camelcase */
const mongoose = require('mongoose');
const InjuryCategory = require('../../models/bmdashboard/buildingInjury');

// ---------- helpers ----------
const parseCSV = (s = '') => String(s).split(',').map(v => v.trim()).filter(Boolean);
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseYMD_UTC = s => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, 0, 0, 0, 0));
};

const parseDateFlexibleUTC = s => {
  const d1 = parseYMD_UTC(s);
  if (d1) return d1;
  if (!s) return null;
  const d2 = new Date(s);
  return Number.isNaN(d2.getTime()) ? null : d2;
};

const parseObjectIdsCSV = (s = '') =>
  parseCSV(s)
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));

const buildMatch = ({ projectIds, startDate, endDate, severities, types, projectNames, projectName }) => {
  const match = {};

  const ids = parseObjectIdsCSV(projectIds);
  if (ids.length) match.projectId = { $in: ids };

  const s = parseDateFlexibleUTC(startDate);
  const e0 = parseDateFlexibleUTC(endDate);
  if (s || e0) {
    match.date = {};
    if (s) match.date.$gte = s;
    if (e0) {
      if (parseYMD_UTC(endDate)) {
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
    match.$or = names.map(n => ({ projectName: { $regex: new RegExp(escapeRe(n), 'i') } }));
  }

  const invalidDate = (startDate && !s && !parseYMD_UTC(startDate)) || (endDate && !e0 && !parseYMD_UTC(endDate));
  return { match, invalidDate };
};

// ---------- controllers ----------
exports.getCategoryBreakdown = async (req, res) => {
  try {
    const { match, invalidDate } = buildMatch(req.query);
    if (invalidDate) return res.status(400).json({ error: 'Invalid startDate or endDate (use YYYY-MM-DD or ISO)' });

    const results = await InjuryCategory.aggregate([
      { $match: match },
      { $addFields: { _nameTrim: { $trim: { input: { $ifNull: ['$projectName', ''] } } } } },
      {
        $group: {
          _id: { projectId: '$projectId', workerCategory: '$workerCategory', projectName: '$_nameTrim' },
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
    if (invalidDate) return res.status(400).json({ error: 'Invalid startDate or endDate (use YYYY-MM-DD or ISO)' });

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