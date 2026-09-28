const dayjs = require('dayjs');
const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const LaborCost = require('../../models/laborCost');
const ProjectStatus = require('../../models/projectStatus');

const COMPARISON_TYPES = {
  PERIOD_COMPARABLE: 'PERIOD_COMPARABLE',
  CURRENT_ONLY: 'CURRENT_ONLY',
  UNAVAILABLE: 'UNAVAILABLE',
};

const STATUS_KEYS = {
  Active: 'activeProjects',
  Completed: 'completedProjects',
  Delayed: 'delayedProjects',
};

const LABOR_HOURS_UNAVAILABLE_REASON =
  'No reliable dated BM labor-hours source exists for arbitrary report periods.';

const MATERIAL_AVAILABLE_CURRENT_ONLY_REASON =
  'Material available is stored as current stockAvailable, not historical snapshots.';

const PROJECT_STATUS_CURRENT_ONLY_REASON =
  'ProjectStatus stores current status only; historical Active/Delayed state cannot be reconstructed.';

const NO_PERIOD_DATA_REASON = 'No data exists for the selected period.';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOUR_MS = MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;

function toDateRange(startDate, endDate) {
  return {
    start: dayjs(startDate).startOf('day').toDate(),
    end: dayjs(endDate).endOf('day').toDate(),
  };
}

function calculatePercentageChange(current, previous) {
  // Keep this helper numeric-only; attachComparison owns non-numeric sentinel messages.
  if (previous === 0) {
    return 0;
  }

  return Math.round(((current - previous) / previous) * 100) / 100;
}

function comparableMetric(value, unit) {
  return {
    value,
    ...(unit ? { unit } : {}),
    comparisonType: COMPARISON_TYPES.PERIOD_COMPARABLE,
  };
}

function currentOnlyMetric(value, reason, unit) {
  return {
    value,
    ...(unit ? { unit } : {}),
    comparisonType: COMPARISON_TYPES.CURRENT_ONLY,
    percentageChange: null,
    unavailableReason: reason,
  };
}

function unavailableMetric(reason, unit) {
  return {
    value: null,
    ...(unit ? { unit } : {}),
    comparisonType: COMPARISON_TYPES.UNAVAILABLE,
    percentageChange: null,
    unavailableReason: reason,
  };
}

async function resolveProject(projectId) {
  if (!projectId || projectId === 'all') {
    return { projectId: 'all', project: null };
  }

  const project = await BuildingProject.findById(projectId).select('_id name').lean();
  if (!project) {
    const error = new Error('Building project not found');
    error.status = 404;
    throw error;
  }

  return { projectId: project._id.toString(), project };
}

async function getCurrentProjectStatusMetrics(project) {
  const match = {};

  if (project) {
    // ProjectStatus has no buildingProject ObjectId; exact name match is the only current mapping.
    match.name = project.name;
  }

  const rows = await ProjectStatus.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts = {
    activeProjects: 0,
    completedProjects: 0,
    delayedProjects: 0,
  };

  rows.forEach((row) => {
    const key = STATUS_KEYS[row._id];
    if (key) counts[key] = row.count;
  });

  return {
    totalProjects: counts.activeProjects + counts.completedProjects + counts.delayedProjects,
    activeProjects: counts.activeProjects,
    delayedProjects: counts.delayedProjects,
  };
}

async function getCompletedProjectStats(project, startDate, endDate) {
  const { start, end } = toDateRange(startDate, endDate);
  const match = {
    status: 'Completed',
    completionDate: { $gte: start, $lte: end },
    startDate: { $exists: true },
  };

  if (project) {
    // ProjectStatus has no buildingProject ObjectId; exact name match is the only current mapping.
    match.name = project.name;
  }

  const rows = await ProjectStatus.aggregate([
    { $match: match },
    {
      $project: {
        durationMs: { $subtract: ['$completionDate', '$startDate'] },
      },
    },
    {
      $group: {
        _id: null,
        completedProjects: { $sum: 1 },
        avgDurationMs: { $avg: '$durationMs' },
      },
    },
  ]);

  // No aggregate row means no completed-project source data for this period, not a real zero.
  if (rows.length === 0) {
    return {
      completedProjects: null,
      avgProjectDuration: null,
    };
  }

  const stats = rows[0] || {};
  // Empty aggregate arrays mean no dated records matched; rows containing 0 remain valid zeros.
  return {
    completedProjects: stats.completedProjects ?? 0,
    avgProjectDuration:
      stats.avgDurationMs === null || stats.avgDurationMs === undefined
        ? null
        : Math.round(stats.avgDurationMs / HOUR_MS),
  };
}

async function getMaterialStats(project, startDate, endDate) {
  const { start, end } = toDateRange(startDate, endDate);
  const materialMatch = project ? { project: project._id } : {};

  const [usageRows, purchaseRows, availableRows] = await Promise.all([
    BuildingMaterial.aggregate([
      { $match: materialMatch },
      { $unwind: '$updateRecord' },
      { $match: { 'updateRecord.date': { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalMaterialUsed: { $sum: '$updateRecord.quantityUsed' },
          materialWasted: { $sum: '$updateRecord.quantityWasted' },
        },
      },
    ]),
    BuildingMaterial.aggregate([
      { $match: materialMatch },
      { $unwind: '$purchaseRecord' },
      {
        $match: {
          'purchaseRecord.date': { $gte: start, $lte: end },
          'purchaseRecord.status': 'Approved',
        },
      },
      {
        $group: {
          _id: null,
          totalMaterialCost: {
            $sum: { $multiply: ['$purchaseRecord.quantity', '$purchaseRecord.unitPrice'] },
          },
        },
      },
    ]),
    BuildingMaterial.aggregate([
      { $match: materialMatch },
      {
        $group: {
          _id: null,
          materialAvailable: { $sum: '$stockAvailable' },
        },
      },
    ]),
  ]);

  return {
    totalMaterialUsed: usageRows.length === 0 ? null : usageRows[0].totalMaterialUsed ?? 0,
    materialWasted: usageRows.length === 0 ? null : usageRows[0].materialWasted ?? 0,
    totalMaterialCost: purchaseRows.length === 0 ? null : purchaseRows[0].totalMaterialCost ?? 0,
    materialAvailable: availableRows[0]?.materialAvailable || 0,
  };
}

async function getLaborCost(project, startDate, endDate) {
  const { start, end } = toDateRange(startDate, endDate);
  const match = { date: { $gte: start, $lte: end } };

  if (project) {
    // LaborCost links to BM projects by project_name; there is no stored buildingProject ObjectId.
    match.project_name = project.name;
  }

  const rows = await LaborCost.aggregate([
    { $match: match },
    { $group: { _id: null, totalLaborCost: { $sum: '$cost' } } },
  ]);

  // Preserve real zero costs while marking periods with no labor records as unavailable.
  return rows.length === 0 ? null : rows[0].totalLaborCost ?? 0;
}

function comparableOrUnavailableMetric(value, unit) {
  // Reuse the existing UNAVAILABLE/null contract so the frontend can render N/A consistently.
  return value === null
    ? unavailableMetric(NO_PERIOD_DATA_REASON, unit)
    : comparableMetric(value, unit);
}

async function calculatePeriodMetrics({ project, startDate, endDate }) {
  const [currentProjectStatus, completedStats, materialStats, totalLaborCost] = await Promise.all([
    getCurrentProjectStatusMetrics(project),
    getCompletedProjectStats(project, startDate, endDate),
    getMaterialStats(project, startDate, endDate),
    getLaborCost(project, startDate, endDate),
  ]);

  return {
    totalProjects: currentOnlyMetric(
      currentProjectStatus.totalProjects,
      PROJECT_STATUS_CURRENT_ONLY_REASON,
    ),
    completedProjects: comparableOrUnavailableMetric(completedStats.completedProjects),
    delayedProjects: currentOnlyMetric(
      currentProjectStatus.delayedProjects,
      PROJECT_STATUS_CURRENT_ONLY_REASON,
    ),
    activeProjects: currentOnlyMetric(
      currentProjectStatus.activeProjects,
      PROJECT_STATUS_CURRENT_ONLY_REASON,
    ),
    avgProjectDuration: comparableOrUnavailableMetric(completedStats.avgProjectDuration, 'hrs'),
    totalMaterialCost: comparableOrUnavailableMetric(materialStats.totalMaterialCost, 'USD'),
    totalMaterialUsed: comparableOrUnavailableMetric(materialStats.totalMaterialUsed),
    totalLaborHoursInvested: unavailableMetric(LABOR_HOURS_UNAVAILABLE_REASON, 'hrs'),
    totalLaborCost: comparableOrUnavailableMetric(totalLaborCost, 'USD'),
    materialAvailable: currentOnlyMetric(
      materialStats.materialAvailable,
      MATERIAL_AVAILABLE_CURRENT_ONLY_REASON,
    ),
    materialWasted: comparableOrUnavailableMetric(materialStats.materialWasted),
  };
}

function attachComparison(currentMetrics, comparisonMetrics) {
  return Object.fromEntries(
    Object.entries(currentMetrics).map(([metricName, metric]) => {
      if (metric.comparisonType !== COMPARISON_TYPES.PERIOD_COMPARABLE) {
        return [metricName, metric];
      }

      const comparisonValue = comparisonMetrics[metricName]?.value ?? null;
      const hasNumericValues =
        typeof metric.value === 'number' && typeof comparisonValue === 'number';
      // A zero comparison period is only comparable when the current period is also zero.
      const percentageChange =
        hasNumericValues && (comparisonValue !== 0 || metric.value === 0)
          ? calculatePercentageChange(metric.value, comparisonValue)
          : 'No Comparison Data';

      return [
        metricName,
        {
          ...metric,
          comparisonValue,
          percentageChange,
        },
      ];
    }),
  );
}

async function getWeeklyProjectSummaryProjectStatus({
  projectId,
  startDate,
  endDate,
  comparisonStartDate,
  comparisonEndDate,
}) {
  const { projectId: resolvedProjectId, project } = await resolveProject(projectId);
  const currentMetrics = await calculatePeriodMetrics({ project, startDate, endDate });

  if (!comparisonStartDate && !comparisonEndDate) {
    return {
      projectId: resolvedProjectId,
      current: { startDate, endDate, metrics: currentMetrics },
      comparison: null,
    };
  }

  const comparisonMetrics = await calculatePeriodMetrics({
    project,
    startDate: comparisonStartDate,
    endDate: comparisonEndDate,
  });

  return {
    projectId: resolvedProjectId,
    current: {
      startDate,
      endDate,
      metrics: attachComparison(currentMetrics, comparisonMetrics),
    },
    comparison: {
      startDate: comparisonStartDate,
      endDate: comparisonEndDate,
      metrics: comparisonMetrics,
    },
  };
}

module.exports = {
  COMPARISON_TYPES,
  calculatePercentageChange,
  getWeeklyProjectSummaryProjectStatus,
  testExports: {
    attachComparison,
    calculatePeriodMetrics,
    getMaterialStats,
  },
};
