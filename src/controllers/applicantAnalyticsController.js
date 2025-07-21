function getPreviousPeriod(start, end, type) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  switch (type) {
    case 'week':
      return {
        start: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      };
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      endDate.setMonth(endDate.getMonth() - 1);
      return { start: startDate, end: endDate };
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      endDate.setFullYear(endDate.getFullYear() - 1);
      return { start: startDate, end: endDate };
    default:
      return { start: startDate, end: endDate };
  }
}

const experienceBreakdownController = function (Applicant) {
  const getExperienceBreakdown = async (req, res) => {
    try {
      const { startDate, endDate, roles } = req.query;
      const match = {};

      if (startDate || endDate) {
        match.startDate = {};
        if (startDate) match.startDate.$gte = new Date(startDate);
        if (endDate) match.startDate.$lte = new Date(endDate);
      }

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

  const getApplicantSources = async (req, res) => {
    try {
      const { startDate, endDate, roles, comparisonType } = req.query;
      const match = {};

      if (startDate || endDate) {
        match.startDate = {};
        if (startDate) match.startDate.$gte = new Date(startDate);
        if (endDate) match.startDate.$lte = new Date(endDate);
      }

      if (roles) {
        const rolesArray = Array.isArray(roles) ? roles : roles.split(',');
        match.roles = { $in: rolesArray };
      }

      const currentData = await Applicant.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$source',
            value: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            name: '$_id',
            value: 1,
          },
        },
      ]);

      const total = currentData.reduce((sum, item) => sum + item.value, 0);
      const sources = currentData.map((item) => ({
        ...item,
        percentage: ((item.value / total) * 100).toFixed(1),
      }));

      let comparisonText = '';
      if (comparisonType && startDate && endDate) {
        const { start, end } = getPreviousPeriod(startDate, endDate, comparisonType);

        const previousMatch = {
          ...match,
          startDate: {
            $gte: start,
            $lte: end,
          },
        };

        const previousTotalAgg = await Applicant.aggregate([
          { $match: previousMatch },
          { $count: 'count' },
        ]);

        const previousTotal = previousTotalAgg[0]?.count || 0;

        if (previousTotal > 0) {
          const change = ((total - previousTotal) / previousTotal) * 100;
          comparisonText =
            change >= 0
              ? `${change.toFixed(1)}% increase over last ${comparisonType}`
              : `${Math.abs(change).toFixed(1)}% decrease over last ${comparisonType}`;
        }
      }

      return res.status(200).json({ sources, comparisonText });
    } catch (error) {
      console.error('Error in getApplicantSources:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  return {
    getExperienceBreakdown,
    getApplicantSources,
  };
};

module.exports = experienceBreakdownController;
