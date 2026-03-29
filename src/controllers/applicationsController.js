const Application = require('../models/application');
const { getRangeFromQuery, getPreviousRange } = require('../utilities/dateRanges');
const { aggregateByCountry } = require('../services/applicationsService');
const cache = require('../utilities/cache');

function parseRolesParam(param) {
  if (!param) return null;
  if (typeof param !== 'string') {
    const err = new Error('roles must be a comma-separated string.');
    err.status = 400;
    throw err;
  }
  return param
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
}

exports.getRoles = async (_req, res, next) => {
  try {
    const roles = await Application.distinct('role');
    roles.sort();
    res.json({ roles });
  } catch (e) {
    next(e);
  }
};

exports.getApplications = async (req, res, next) => {
  try {
    const range = getRangeFromQuery(req.query);
    const roles = parseRolesParam(req.query.roles);
    const key = `apps:${JSON.stringify({ range, roles })}`;

    const cached = cache.get(key);
    if (cached) return res.json(cached);

    const data = await aggregateByCountry(range, roles);
    const payload = {
      data,
      meta: { startDate: range.start, endDate: range.end, type: range.type },
    };
    cache.set(key, payload);
    res.json(payload);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

exports.getComparison = async (req, res, next) => {
  try {
    const current = getRangeFromQuery(req.query);
    if (current.type === 'custom') {
      return res.status(400).json({ error: 'Comparison not available for custom ranges.' });
    }

    const previous = getPreviousRange(current);
    const roles = parseRolesParam(req.query.roles);
    const key = `cmp:${JSON.stringify({ current, previous, roles })}`;

    const cached = cache.get(key);
    if (cached) return res.json(cached);

    const [curr, prev] = await Promise.all([
      aggregateByCountry(current, roles),
      aggregateByCountry(previous, roles),
    ]);

    const prevMap = new Map(prev.map((r) => [r.country, r.count]));

    const percentByCountry = {};
    let currTotal = 0;
    let prevTotal = 0;

    curr.forEach(({ country, count }) => {
      currTotal += count;
      const prevCount = prevMap.get(country) || 0;
      prevTotal += prevCount;

      let pct;
      if (prevCount === 0) {
        pct = count === 0 ? 0 : 100;
      } else {
        pct = ((count - prevCount) / prevCount) * 100;
      }
      percentByCountry[country] = pct;
    });

    prev.forEach(({ country }) => {
      if (!(country in percentByCountry)) {
        percentByCountry[country] = -100;
      }
    });

    let overallPercent;
    if (prevTotal === 0) {
      overallPercent = currTotal > 0 ? 100 : 0;
    } else {
      overallPercent = ((currTotal - prevTotal) / prevTotal) * 100;
    }

    const payload = {
      current: { startDate: current.start, endDate: current.end, type: current.type },
      previous: { startDate: previous.start, endDate: previous.end, type: previous.type },
      percentByCountry,
      overallPercent,
    };
    cache.set(key, payload);
    res.json(payload);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};
