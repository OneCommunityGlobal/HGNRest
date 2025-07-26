// controllers/optAnalyticsController.js

const optAnalyticsController = function (CandidateOPTStatus) {
  const getOPTStatusBreakdown = async (req, res) => {
    try {
      const { startDate, endDate, role } = req.query;
      const match = {};

      if (startDate || endDate) {
        match.applicationDate = {};
        if (startDate) match.applicationDate.$gte = new Date(startDate);
        if (endDate) match.applicationDate.$lte = new Date(endDate);
      }

      if (role) {
        const rolesArray = Array.isArray(role) ? role : role.split(',');
        match.role = { $in: rolesArray };
      }

      // Aggregate the data from the database
      const breakdown = await CandidateOPTStatus.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$optStatus',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            optStatus: '$_id',
            count: 1,
          },
        },
      ]);

      if (!breakdown || breakdown.length === 0) {
        return res.status(404).json({ message: 'No data found for the given filters' });
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
