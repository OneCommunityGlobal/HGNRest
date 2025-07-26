const experienceBreakdownController = function (Applicant) {
  const getExperienceBreakdown = async (req, res) => {
    try {
      const { startDate, endDate, roles } = req.query;
      const match = {};

      // Filter by startDate range
      if (startDate || endDate) {
        match.startDate = {};
        if (startDate) match.startDate.$gte = new Date(startDate);
        if (endDate) match.startDate.$lte = new Date(endDate);
      }

      // Filter by roles
      if (roles) {
        const rolesArray = Array.isArray(roles) ? roles : roles.split(',');
        match.roles = { $in: rolesArray };
      }

      const breakdown = await Applicant.aggregate([
        { $match: match },
        {
          $addFields: {
            experienceCategory: {
              $switch: {
                branches: [
                  { case: { $lte: ['$experience', 1] }, then: '0-1 years' },
                  {
                    case: {
                      $and: [{ $gt: ['$experience', 1] }, { $lte: ['$experience', 3] }],
                    },
                    then: '1-3 years',
                  },
                  {
                    case: {
                      $and: [{ $gt: ['$experience', 3] }, { $lte: ['$experience', 5] }],
                    },
                    then: '3-5 years',
                  },
                ],
                default: '5+ years',
              },
            },
          },
        },
        {
          $group: {
            _id: '$experienceCategory',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            experience: '$_id',
            count: 1,
          },
        },
      ]);

      if (!breakdown.length) {
        return res.status(404).json({ message: 'No Data Available' });
      }

      const total = breakdown.reduce((sum, item) => sum + item.count, 0);
      const data = breakdown.map((item) => ({
        ...item,
        percentage: ((item.count / total) * 100).toFixed(2),
      }));

      return res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching experience breakdown:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  return {
    getExperienceBreakdown,
  };
};

module.exports = experienceBreakdownController;
