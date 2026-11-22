const dayjs = require('dayjs');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const ProjectStatus = require('../models/projectStatus');

const calcPct = (count, total) => {
  if (!total) return 0;
  return Number.parseFloat(((count / total) * 100).toFixed(1));
};

const STATUS_KEYS = { Active: 'active', Completed: 'completed', Delayed: 'delayed' };

const getStatusKey = (value) => {
  const normalized = String(value || '').toLowerCase();
  return ['active', 'completed', 'delayed'].includes(normalized) ? normalized : null;
};

async function aggregateStatusRows({ buildingPipeline, legacyPipeline }) {
  const buildingRows = await BuildingProject.aggregate(buildingPipeline);
  if (buildingRows.length > 0 || typeof ProjectStatus.aggregate !== 'function') {
    return buildingRows;
  }

  // Keep existing status records visible until legacy data is migrated into buildingProjects.
  const legacyRows = await ProjectStatus.aggregate(legacyPipeline);
  return legacyRows || [];
}

async function getProjectStatusSummary({ startDate, endDate }) {
  try {
    const match = {};

    if (startDate || endDate) {
      match.startDate = {};
      if (startDate) match.startDate.$gte = dayjs(startDate).startOf('day').toDate();
      if (endDate) match.startDate.$lte = dayjs(endDate).endOf('day').toDate();
    }

    const buildingPipeline = [
      Object.keys(match).length ? { $match: match } : null,
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ].filter(Boolean);

    const legacyPipeline = [
      Object.keys(match).length ? { $match: match } : null,
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ].filter(Boolean);

    const rows = await aggregateStatusRows({ buildingPipeline, legacyPipeline });

    const counts = { active: 0, completed: 0, delayed: 0 };
    rows.forEach((r) => {
      const key = getStatusKey(r._id) || STATUS_KEYS[r._id];
      if (key) counts[key] = r.count;
    });

    const totalProjects = counts.active + counts.completed + counts.delayed;

    const percentages = Object.values(STATUS_KEYS).reduce((acc, key) => {
      acc[key] = calcPct(counts[key], totalProjects);
      return acc;
    }, {});

    return {
      totalProjects,
      activeProjects: counts.active,
      completedProjects: counts.completed,
      delayedProjects: counts.delayed,
      percentages,
      window: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };
  } catch (error) {
    const err = new Error(`Failed to aggregate project status summary: ${error.message}`);
    err.status = 500;
    throw err;
  }
}

module.exports = { getProjectStatusSummary };
