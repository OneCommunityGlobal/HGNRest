const BuildingProject = require('../models/bmdashboard/buildingProject');
const ProjectGlobalDistribution = require('../models/projectGlobalDistribution');
const { getProjectRegion } = require('../utilities/projectRegion');

const LEGACY_STATUS_BY_NORMALIZED_STATUS = {
  active: 'Active',
  delayed: 'Delayed',
  completed: 'Completed',
};

const normalizeStatusFilter = (statusFilter) => {
  const normalizedStatus = String(statusFilter || '').trim().toLowerCase();
  return LEGACY_STATUS_BY_NORMALIZED_STATUS[normalizedStatus] || null;
};

const getProjectsGlobalDistribution = async (req, res) => {
  try {
    const { startDate, endDate, statusFilter } = req.query;

    // const startDate = '2024-01-01';
    // const endDate = '2024-12-31';
    // const status = 'Active';
    const buildingFilter = {};
    const legacyFilter = {};

    if (startDate && endDate) {
      legacyFilter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
      buildingFilter.startDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (statusFilter) {
      const normalizedStatus = normalizeStatusFilter(statusFilter);
      if (!normalizedStatus) {
        return res.status(400).json({ message: 'Invalid project status' });
      }
      legacyFilter.status = normalizedStatus;
      buildingFilter.status = normalizedStatus.toLowerCase();
    }

    const projects = await BuildingProject.find(buildingFilter)
      .select('country region status')
      .lean();
    const legacyProjects = projects.length
      ? []
      : await ProjectGlobalDistribution.find(legacyFilter).select('region').lean();

    const regionCounts = {};
    const total = projects.length + legacyProjects.length;

    projects.forEach((project) => {
      const region = project.region || getProjectRegion(project.country);
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });
    legacyProjects.forEach((project) => {
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
