const CandidateOPTStatus = require('../models/CandidateOPTStatus');

const isValidDate = (date) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  const parsedDate = new Date(date);
  return !Number.isNaN(parsedDate.getTime());
};

const parseDateParam = (dateStr, fieldName, res) => {
  if (!isValidDate(dateStr)) {
    res.status(400).json({ message: `Invalid ${fieldName}. Use ISO format (YYYY-MM-DD).` });
    return null;
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    res.status(400).json({ message: `Invalid ${fieldName}. Use ISO format (YYYY-MM-DD).` });
    return null;
  }
  return parsed;
};

const validateDateRange = (start, end, startDate, endDate, res) => {
  if (start && end && start > end) {
    res.status(400).json({ message: 'startDate cannot be greater than endDate.' });
    return false;
  }
  if (startDate && endDate && start.toDateString() === end.toDateString()) {
    res.status(400).json({ message: 'startDate and endDate cannot be the same.' });
    return false;
  }
  return true;
};

const sanitizeRole = (role) => {
  if (!role) return null;
  const str = String(role);
  return str.replace(/[^a-zA-Z0-9 _-]/g, '');
};

const buildQuery = (start, end, role) => {
  const query = {};
  if (start || end) {
    query.applicationDate = {};
    if (start) query.applicationDate.$gte = start;
    if (end) query.applicationDate.$lte = end;
  }
  const safeRole = sanitizeRole(role);
  if (safeRole) {
    query.role = safeRole;
  }
  return query;
};

const computeBreakdown = (result) => {
  const totalCandidates = result.length;
  const breakDownMap = {};
  result.forEach(({ optStatus }) => {
    breakDownMap[optStatus] = (breakDownMap[optStatus] || 0) + 1;
  });
  const breakDown = Object.entries(breakDownMap).map(([optStatus, count]) => ({
    optStatus,
    count,
    percentage: Number(((count / totalCandidates) * 100).toFixed(2)),
  }));
  return { totalCandidates, breakDown };
};

module.exports = function optAnalyticsController() {
  return {
    getOPTStatusBreakdown: async function getOPTStatusBreakdown(req, res, next) {
      try {
        const { startDate, endDate, role } = req.query;

        let start;
        let end;

        if (startDate) {
          start = parseDateParam(startDate, 'startDate', res);
          if (start === null) return null;
        }

        if (endDate) {
          end = parseDateParam(endDate, 'endDate', res);
          if (end === null) return null;
        }

        if (!validateDateRange(start, end, startDate, endDate, res)) return null;

        const query = buildQuery(start, end, role);

        const result = await CandidateOPTStatus.find(query);

        if (!result.length) {
          return res.json({
            totalCandidates: 0,
            breakDown: [],
            message: 'No records found for the given filters.',
          });
        }

        return res.json(computeBreakdown(result));
      } catch (err) {
        next(err);
      }
      return null;
    },
  };
};
