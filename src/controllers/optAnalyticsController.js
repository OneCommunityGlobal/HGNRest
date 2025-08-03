const CandidateOPTStatus = require('../models/CandidateOPTStatus');

module.exports = () => ({
  getOPTStatusBreakdown: async (req, res, next) => {
    try {
      console.log(req.query);
      console.log('in getOPTStatusBreakdown');
      const { startDate, endDate, role } = req.query;
      const query = {};
      if (startDate || endDate) {
        query.applicationDate = {};
        if (startDate) query.applicationDate.$gte = new Date(startDate);
        if (endDate) query.applicationDate.$lte = new Date(endDate);
      }
      if (role) query.role = role;
      const result = await CandidateOPTStatus.find(query);
      const totalCandidates = result.length;
      const breakDownMap = {};
      result.forEach((candidate) => {
        const { optStatus } = candidate;
        breakDownMap[optStatus] = (breakDownMap[optStatus] || 0) + 1;
      });
      const breakDown = Object.entries(breakDownMap).map(([optStatus, count]) => ({
        optStatus,
        count,
        percentage: parseFloat(((count / totalCandidates) * 100).toFixed(2)),
      }));
      res.json({
        totalCandidates,
        breakDown,
      });
    } catch (err) {
      next(err);
    }
  },
});
