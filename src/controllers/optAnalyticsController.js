const CandidateOPTStatus = require('../models/CandidateOPTStatus');

module.exports = () => ({
  getOPTStatusBreakdown: async (req, res, next) => {
    try {
      const { startDate, endDate, role } = req.query;
      const query = {};

      let start;
      let end;

      if (startDate) {
        start = new Date(startDate);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            message: 'Invalid startDate. Use ISO format (YYYY-MM-DD).',
          });
        }
      }

      if (endDate) {
        end = new Date(endDate);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            message: 'Invalid endDate. Use ISO format (YYYY-MM-DD).',
          });
        }
      }

      if (start && end && start > end) {
        return res.status(400).json({
          message: 'startDate cannot be greater than endDate.',
        });
      }

      if (start || end) {
        query.applicationDate = {};
        if (start) query.applicationDate.$gte = start;
        if (end) query.applicationDate.$lte = end;
      }

      if (role) {
        query.role = role;
      }

      const result = await CandidateOPTStatus.find(query);

      if (!result.length) {
        return res.json({
          totalCandidates: 0,
          breakDown: [],
          message: 'No records found for the given filters.',
        });
      }

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

      return res.json({
        totalCandidates,
        breakDown,
      });
    } catch (err) {
      next(err);
    }
  },
});
