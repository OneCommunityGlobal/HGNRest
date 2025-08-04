const getPreviousPeriod = (start, end, type) => {
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
};

const experienceBreakdownController = function (Applicant) {
  const getExperienceBreakdown = async (req, res) => {
    try {
      const { startDate, endDate, roles } = req.query;
      const match = {};

      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        match.$or = [];

        if (start && end) {
          match.$or = [
            { $and: [{ startDate: { $lte: end } }, { endDate: { $gte: start } }] },
            { $and: [{ startDate: { $lte: end } }, { endDate: { $exists: false } }] },
            { $and: [{ startDate: { $exists: false } }, { endDate: { $gte: start } }] },
          ];
        } else if (start) {
          match.$or.push({ endDate: { $gte: start } }, { endDate: null });
        } else if (end) {
          match.$or.push({ startDate: { $lte: end } }, { startDate: null });
        }
      }

      if (roles) {
        const rolesArray = Array.isArray(roles) ? roles : roles.split(',');
        if (rolesArray.length > 0) {
          match.roles = { $in: rolesArray };
        }
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
                    case: { $and: [{ $gt: ['$experience', 1] }, { $lte: ['$experience', 3] }] },
                    then: '1-3 years',
                  },
                  {
                    case: { $and: [{ $gt: ['$experience', 3] }, { $lte: ['$experience', 5] }] },
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
      const data = breakdown.map(item => ({
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
      const { startDate, endDate, roles: rolesQuery, comparisonType } = req.query;

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      const allApplicants = await Applicant.find();

      const filterApplicants = (applicants, filterStart, filterEnd, rolesStr) => {
        const rolesArray = rolesStr ? rolesStr.split(',') : null;
      
        return applicants.filter(app => {
          const matchesRole = !rolesArray || app.roles?.some(role => rolesArray.includes(role));
      
          let matchesDate = true;
          if (filterStart && filterEnd) {
            matchesDate =
              (!app.startDate || app.startDate <= filterEnd) &&
              (!app.endDate || app.endDate >= filterStart);
          } else if (filterStart) {
            matchesDate = !app.endDate || app.endDate >= filterStart;
          } else if (filterEnd) {
            matchesDate = !app.startDate || app.startDate <= filterEnd;
          }
      
          return matchesRole && matchesDate;
        });
      };
      

      const filteredApplicants = filterApplicants(allApplicants, start, end, rolesQuery);
      
      const countSources = (list) => {
        const map = {};
        for (const a of list) {
          const src = a.source || 'Unknown';
          map[src] = (map[src] || 0) + 1;
        }
        return map;
      };

      const currentMap = countSources(filteredApplicants);
      const totalCurrent = Object.values(currentMap).reduce((a, b) => a + b, 0);
      const sources = Object.entries(currentMap).map(([name, value]) => ({
        name,
        value,
        percentage: ((value / totalCurrent) * 100).toFixed(1),
      }));

      let comparisonText = '';
      if (comparisonType && ['week', 'month', 'year'].includes(comparisonType) && start && end) {
        const { start: prevStart, end: prevEnd } = getPreviousPeriod(start, end, comparisonType);
        const prevFiltered = filterApplicants(allApplicants, prevStart, prevEnd, rolesQuery);
        const totalPrevious = prevFiltered.length;

        if (totalPrevious > 0) {
          const percentChange = ((totalCurrent - totalPrevious) / totalPrevious) * 100;
          const absChange = Math.abs(percentChange.toFixed(1));
          comparisonText =
            percentChange >= 0
              ? `${absChange}% more than last ${comparisonType}`
              : `${absChange}% less than last ${comparisonType}`;
        } else {
          comparisonText = `No applicants last ${comparisonType}`;
        }
      }

      return res.json({ sources, comparisonText });
    } catch (err) {
      console.error('Error fetching applicant sources:', err);
      return res.status(500).json({ message: 'Failed to get applicant sources.' });
    }
  };

  return {
    getExperienceBreakdown,
    getApplicantSources,
  };
};

module.exports = experienceBreakdownController;
