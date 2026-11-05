const dayjs = require('dayjs');
const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const BuildingTool = require('../../models/bmdashboard/buildingTool');
const Issue = require('../../models/bmdashboard/Issues');
const ProjectRiskProfile = require('../../models/bmdashboard/projectRiskProfile');
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

const HISTORICAL_SNAPSHOT_UNAVAILABLE_REASON =
  'Historical snapshots are not available for the selected period.';

const NO_PERIOD_DATA_REASON = 'No data exists for the selected period.';

const PROJECTION_CURRENT_ONLY_REASON =
  'Projections use the latest cost incurred, so there is no earlier projection to compare with.';

const NO_RISK_PROFILE_REASON =
  'No project with a cost estimate and cost incurred runs through the selected dates.';

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

function dateRangeIncludesToday(startDate, endDate) {
  const startDay = dayjs(startDate).format('YYYY-MM-DD');
  const endDay = dayjs(endDate).format('YYYY-MM-DD');
  const today = dayjs().format('YYYY-MM-DD');

  return startDay <= today && today <= endDay;
}

function roundToTwoDecimals(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function currentSnapshotMetric(value, includesToday, reason, unit) {
  return includesToday
    ? currentOnlyMetric(value, reason, unit)
    : unavailableMetric(HISTORICAL_SNAPSHOT_UNAVAILABLE_REASON, unit);
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
    totalMaterialCost:
      purchaseRows.length === 0 ? null : roundToTwoDecimals(purchaseRows[0].totalMaterialCost ?? 0),
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
  return rows.length === 0 ? null : roundToTwoDecimals(rows[0].totalLaborCost ?? 0);
}

async function getApprovedPurchaseCost(Model, project, startDate, endDate) {
  const { start, end } = toDateRange(startDate, endDate);
  const rows = await Model.aggregate([
    { $match: project ? { project: project._id } : {} },
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
        cost: { $sum: { $multiply: ['$purchaseRecord.quantity', '$purchaseRecord.unitPrice'] } },
      },
    },
  ]);

  // Same rule as the other costs: no approved purchases in the period is unavailable, not $0.
  return rows.length === 0 ? null : roundToTwoDecimals(rows[0].cost ?? 0);
}

// Risk profiles link to an Issue record (projectId is the Issue _id), and the Issue links to the BM project.
async function getRiskProfileFilter(project, start, end) {
  // Only projects that run through the whole selected range, as in the risk profile spec.
  const filter = { startDate: { $lte: start }, endDate: { $gte: end } };
  if (project) {
    const issues = await Issue.find({ projectId: project._id }).select('_id').lean();
    filter.projectId = { $in: issues.map((issue) => issue._id) };
  }
  return filter;
}

// Projected cost = cost so far / share of the project's time that has passed
// (the risk profile spec's currentCostIncurred x (100 / % time elapsed)); overrun = projected - estimate.
async function getCostProjection(project, startDate, endDate, now = new Date()) {
  const { start, end } = toDateRange(startDate, endDate);
  const profiles = await ProjectRiskProfile.find(await getRiskProfileFilter(project, start, end))
    .select('startDate endDate initialCostEstimate currentCostIncurred')
    .lean();

  const totals = profiles.reduce(
    (sum, profile) => {
      const duration = new Date(profile.endDate) - new Date(profile.startDate);
      const elapsedShare = Math.min(1, (now - new Date(profile.startDate)) / duration);
      const hasCosts =
        typeof profile.currentCostIncurred === 'number' && profile.initialCostEstimate > 0;
      if (!hasCosts || !(duration > 0) || !(elapsedShare > 0)) return sum;

      const projected = profile.currentCostIncurred / elapsedShare;
      return {
        projected: sum.projected + projected,
        overrun: sum.overrun + (projected - profile.initialCostEstimate),
        count: sum.count + 1,
      };
    },
    { projected: 0, overrun: 0, count: 0 },
  );

  return totals.count === 0
    ? null
    : {
        // Whole dollars: cents would suggest more precision than an estimate has.
        totalProjectedCost: Math.round(totals.projected),
        predictedCostOverrun: Math.round(totals.overrun),
      };
}

// A projected final cost is forward-looking, so it uses the latest numbers for any selected range.
function projectionMetric(projection, metricName) {
  return projection === null
    ? unavailableMetric(NO_RISK_PROFILE_REASON, 'USD')
    : currentOnlyMetric(projection[metricName], PROJECTION_CURRENT_ONLY_REASON, 'USD');
}

function sumKnownCosts(costs) {
  const known = costs.filter((cost) => cost !== null);
  return known.length === 0 ? null : roundToTwoDecimals(known.reduce((sum, cost) => sum + cost, 0));
}

function comparableOrUnavailableMetric(value, unit) {
  // Reuse the existing UNAVAILABLE/null contract so the frontend can render N/A consistently.
  return value === null
    ? unavailableMetric(NO_PERIOD_DATA_REASON, unit)
    : comparableMetric(value, unit);
}

async function calculatePeriodMetrics({ project, startDate, endDate }) {
  const includesToday = dateRangeIncludesToday(startDate, endDate);
  const [currentProjectStatus, completedStats, materialStats, totalLaborCost] = await Promise.all([
    getCurrentProjectStatusMetrics(project),
    getCompletedProjectStats(project, startDate, endDate),
    getMaterialStats(project, startDate, endDate),
    getLaborCost(project, startDate, endDate),
  ]);

  return {
    totalProjects: currentSnapshotMetric(
      currentProjectStatus.totalProjects,
      includesToday,
      PROJECT_STATUS_CURRENT_ONLY_REASON,
    ),
    completedProjects: comparableOrUnavailableMetric(completedStats.completedProjects),
    delayedProjects: currentSnapshotMetric(
      currentProjectStatus.delayedProjects,
      includesToday,
      PROJECT_STATUS_CURRENT_ONLY_REASON,
    ),
    activeProjects: currentSnapshotMetric(
      currentProjectStatus.activeProjects,
      includesToday,
      PROJECT_STATUS_CURRENT_ONLY_REASON,
    ),
    avgProjectDuration: comparableOrUnavailableMetric(completedStats.avgProjectDuration, 'hrs'),
    totalMaterialCost: comparableOrUnavailableMetric(materialStats.totalMaterialCost, 'USD'),
    totalMaterialUsed: comparableOrUnavailableMetric(materialStats.totalMaterialUsed),
    totalLaborHoursInvested: unavailableMetric(LABOR_HOURS_UNAVAILABLE_REASON, 'hrs'),
    totalLaborCost: comparableOrUnavailableMetric(totalLaborCost, 'USD'),
    materialAvailable: currentSnapshotMetric(
      materialStats.materialAvailable,
      includesToday,
      MATERIAL_AVAILABLE_CURRENT_ONLY_REASON,
    ),
    materialWasted: comparableOrUnavailableMetric(materialStats.materialWasted),
  };
}

async function calculateFinancialMetrics({ project, startDate, endDate }) {
  const [totalMaterialCost, totalLaborCost, totalEquipmentCost, projection] = await Promise.all([
    getApprovedPurchaseCost(BuildingMaterial, project, startDate, endDate),
    getLaborCost(project, startDate, endDate),
    getApprovedPurchaseCost(BuildingTool, project, startDate, endDate),
    getCostProjection(project, startDate, endDate),
  ]);

  return {
    totalProjectedCost: projectionMetric(projection, 'totalProjectedCost'),
    predictedCostOverrun: projectionMetric(projection, 'predictedCostOverrun'),
    totalProjectCost: comparableOrUnavailableMetric(
      sumKnownCosts([totalMaterialCost, totalLaborCost, totalEquipmentCost]),
      'USD',
    ),
    totalMaterialCost: comparableOrUnavailableMetric(totalMaterialCost, 'USD'),
    totalLaborCost: comparableOrUnavailableMetric(totalLaborCost, 'USD'),
    totalEquipmentCost: comparableOrUnavailableMetric(totalEquipmentCost, 'USD'),
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

// Shared by Project Status and Financials: Overview, which only differ in the metrics they calculate.
async function buildPeriodSummary(
  calculateMetrics,
  { projectId, startDate, endDate, comparisonStartDate, comparisonEndDate },
) {
  const { projectId: resolvedProjectId, project } = await resolveProject(projectId);
  const currentMetrics = await calculateMetrics({ project, startDate, endDate });

  if (!comparisonStartDate && !comparisonEndDate) {
    return {
      projectId: resolvedProjectId,
      current: { startDate, endDate, metrics: currentMetrics },
      comparison: null,
    };
  }

  const comparisonMetrics = await calculateMetrics({
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

function getWeeklyProjectSummaryProjectStatus(query) {
  return buildPeriodSummary(calculatePeriodMetrics, query);
}

function getWeeklyProjectSummaryFinancialOverview(query) {
  return buildPeriodSummary(calculateFinancialMetrics, query);
}

module.exports = {
  COMPARISON_TYPES,
  calculatePercentageChange,
  getWeeklyProjectSummaryProjectStatus,
  getWeeklyProjectSummaryFinancialOverview,
  testExports: {
    attachComparison,
    calculateFinancialMetrics,
    calculatePeriodMetrics,
    getApprovedPurchaseCost,
    getCostProjection,
    getMaterialStats,
    sumKnownCosts,
  },
};
