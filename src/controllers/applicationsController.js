// HGNRest/src/controllers/applications.controller.js
const Application = require('../models/application');
const { getRangeFromQuery, getPreviousRange } = require('../utilities/dateRanges');
const { aggregateByCountry } = require('../services/applicationsService');
const cache = require('../utilities/cache');

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
    const roles = req.query.roles ? req.query.roles.split(',') : null;
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
    const roles = req.query.roles ? req.query.roles.split(',') : null;
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
      const p = prevMap.get(country) || 0;
      prevTotal += p;
      if (p === 0 && count === 0) {
        percentByCountry[country] = 0;
      } else if (p === 0) {
        percentByCountry[country] = 100;
      } else {
        percentByCountry[country] = ((count - p) / p) * 100;
      }
    });

    prev.forEach(({ country }) => {
      if (!(country in percentByCountry)) percentByCountry[country] = -100;
    });

    // Avoid nested ternaries per ESLint rule
    let overallPercent;
    if (prevTotal === 0) {
      if (currTotal > 0) overallPercent = 100;
      else overallPercent = 0;
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
    next(e);
  }
};
