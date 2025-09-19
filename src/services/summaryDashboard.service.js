// summaryDashboard.service.js
const SummaryDashboardMetrics = require('../models/bmdashboard/summaryDashboardMetrics');

// Get latest snapshot (current)
exports.getAllMetrics = async () => {
  const snapshot = await SummaryDashboardMetrics.findOne({ snapshotType: 'current' }).sort({
    date: -1,
  });

  if (!snapshot) return null;

  // Flatten metrics (only values)
  const flatMetrics = Object.fromEntries(
    Object.entries(snapshot.metrics).map(([key, metric]) => [key, metric?.value ?? 0]),
  );

  return {
    _id: snapshot._id,
    date: snapshot.date,
    snapshotType: snapshot.snapshotType,
    metrics: flatMetrics,
  };
};

// Get material cost trends
exports.getMaterialCostTrends = async () => {
  const snapshots = await SummaryDashboardMetrics.find({
    'metrics.totalMaterialCost.value': { $exists: true },
  }).sort({ date: 1 });

  return snapshots.map((s) => ({
    date: s.date,
    cost: s.metrics.totalMaterialCost.value || 0,
  }));
};

// Force refresh (seed random snapshot for prototype)
// exports.forceRefresh = async () => {
//   const newSnapshot = new SummaryDashboardMetrics({
//     snapshotType: 'current',
//     metrics: {
//       totalProjects: { value: Math.floor(Math.random() * 500) },
//       completedProjects: { value: Math.floor(Math.random() * 200) },
//       delayedProjects: { value: Math.floor(Math.random() * 50) },
//       activeProjects: { value: Math.floor(Math.random() * 300) },
//       avgProjectDuration: { value: 1754 },
//       totalMaterialCost: { value: 27000 + Math.floor(Math.random() * 2000) },
//       totalLaborCost: { value: 18000 + Math.floor(Math.random() * 1000) },
//       totalMaterialUsed: { value: 2700 + Math.floor(Math.random() * 100) },
//       materialWasted: { value: Math.floor(Math.random() * 1000) },
//       materialAvailable: { value: Math.floor(Math.random() * 700) },
//       materialUsed: { value: Math.floor(Math.random() * 1200) },
//       totalLaborHours: { value: 12800 + Math.floor(Math.random() * 500) },
//     },
//   });

//   await newSnapshot.save();
//   return newSnapshot;
// };

// Get history of a metric
exports.getHistory = async (startDate, endDate, metric) => {
  const snapshots = await SummaryDashboardMetrics.find({
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    [`metrics.${metric}.value`]: { $exists: true },
  }).sort({ date: 1 });

  return snapshots.map((s) => ({
    date: s.date,
    value: s.metrics[metric]?.value || 0,
  }));
};
