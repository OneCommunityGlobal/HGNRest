const optAnalyticsController = function (CandidateOPTStatus) {
  const getOPTStatusBreakdown = async (req, res) => {
    try {
      const { startDate, endDate, roles } = req.query;
      const match = {};

      if (startDate || endDate) {
        match.startDate = {};
        if (startDate) match.startDate.$gte = new Date(startDate);
        if (endDate) match.endDate.$gte = new Date(endDate);
      }
      if (roles) {
        const rolesArray = Array.isArray(roles) ? roles : roles.split(',');
        match.roles = { $in: rolesArray };
      }

      const breakdown = await CandidateOPTStatus.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$roles',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            roles: '$_id',
            count: 1,
          },
        },
      ]);
      if (!breakdown) {
        return res.status(404).json({ message: 'Data not found' });
      }
      const total = breakdown.reduce((sum, item) => sum + item.count, 0);
      const data = breakdown.map((item) => ({
        ...item,
        percentage: ((item.count / total) * 100).toFixed(2),
      }));
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching job status breakdown:', error);
      res.status(500).json({ message: 'Error fetching job status breakdown', error });
    }
  };

  return {
    getOPTStatusBreakdown,
  };
};
module.exports = optAnalyticsController;
