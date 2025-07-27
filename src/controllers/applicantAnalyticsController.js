const experienceBreakdownController = function (Applicant) {
  const getExperienceBreakdown = async (req, res) => {
    try {
      const { startDate, endDate, roles } = req.query;

      const pipeline = [];

      // Match users whose startDate falls within given range
      if (startDate && endDate) {
        pipeline.push({
          $match: {
            $expr: {
              $and: [
                {
                  $gte: [{ $dateFromString: { dateString: '$startDate' } }, new Date(startDate)],
                },
                {
                  $lte: [{ $dateFromString: { dateString: '$startDate' } }, new Date(endDate)],
                },
              ],
            },
          },
        });
      }

      // Optional: filter by roles
      if (roles) {
        const rolesArray = Array.isArray(roles) ? roles : roles.split(',');
        pipeline.push({
          $match: {
            roles: { $in: rolesArray },
          },
        });
      }

      // Add experience category
      pipeline.push({
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
      });

      // Group by category
      pipeline.push({
        $group: {
          _id: '$experienceCategory',
          count: { $sum: 1 },
        },
      });

      // Final format
      pipeline.push({
        $project: {
          _id: 0,
          experience: '$_id',
          count: 1,
        },
      });

      const breakdown = await Applicant.aggregate(pipeline);

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

  return { getExperienceBreakdown };
};

module.exports = experienceBreakdownController;
