const dayjs = require('dayjs');
const ProjectStatus = require('../models/projectStatus');

// Utility to compute percentages safely
const calcPct = (count, total) => (total ? Number(((count / total) * 100).toFixed(1)) : 0.0);

async function getProjectStatusSummary({ startDate, endDate }) {
  const match = {};

  if (startDate || endDate) {
    match.startDate = {};
    if (startDate) match.startDate.$gte = dayjs(startDate).startOf('day').toDate();
    if (endDate) match.startDate.$lte = dayjs(endDate).endOf('day').toDate();
  }

  const pipeline = [
    Object.keys(match).length ? { $match: match } : null,
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ].filter(Boolean);

  const rows = await ProjectStatus.aggregate(pipeline);

  // Normalize counts
  const counts = { active: 0, completed: 0, delayed: 0 };
  rows.forEach((r) => {
    if (r._id === 'Active') counts.active = r.count;
    if (r._id === 'Completed') counts.completed = r.count;
    if (r._id === 'Delayed') counts.delayed = r.count;
  });

  const totalProjects = counts.active + counts.completed + counts.delayed;

  return {
    totalProjects,
    activeProjects: counts.active,
    completedProjects: counts.completed,
    delayedProjects: counts.delayed,
    percentages: {
      active: calcPct(counts.active, totalProjects),
      completed: calcPct(counts.completed, totalProjects),
      delayed: calcPct(counts.delayed, totalProjects),
    },
    window: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
  };
}

module.exports = { getProjectStatusSummary };
