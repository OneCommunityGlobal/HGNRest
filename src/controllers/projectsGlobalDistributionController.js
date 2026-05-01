const ProjectGlobalDistribution = require('../models/projectGlobalDistribution');

const getProjectsGlobalDistribution = async (req, res) => {
  try {
    const { startDate, endDate, statusFilter } = req.query;

    // const startDate = '2024-01-01';
    // const endDate = '2024-12-31';
    // const status = 'Active';
    const filter = {};

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (statusFilter) {
      filter.status = statusFilter;
    }

    const projects = await ProjectGlobalDistribution.find(filter);

    const regionCounts = {};
    const total = projects.length;

    projects.forEach((project) => {
      regionCounts[project.region] = (regionCounts[project.region] || 0) + 1;
    });

    const regionPercentages = Object.keys(regionCounts).map((region) => ({
      region,
      percentage: total > 0 ? ((regionCounts[region] / total) * 100).toFixed(2) : '0.00',
    }));

    res.status(200).json(regionPercentages);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve projects global distribution data' });
  }
};

module.exports = getProjectsGlobalDistribution;
