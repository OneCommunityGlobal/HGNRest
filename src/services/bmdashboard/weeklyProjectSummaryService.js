const dayjs = require('dayjs');
const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const BuildingTimeLog = require('../../models/bmdashboard/buildingTimeLogger');
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

const MATERIAL_AVAILABLE_CURRENT_ONLY_REASON =
  'Shows current stock available; past stock levels are not stored.';

const ACTIVE_DELAYED_CURRENT_ONLY_REASON =
  "Projects in progress at the end of the selected period, split by each project's current Active/Delayed status; past status is not stored.";

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

// Rebuilds project counts as of the end of the selected period from startDate/completionDate,
// so past periods show values instead of N/A. Only the Active/Delayed split relies on current status.
async function getProjectStatusAsOf(project, endDate) {
  const { end } = toDateRange(endDate, endDate);
  const started = { $lte: ['$startDate', end] };
  const completedByEnd = {
    $and: [
      started,
      { $eq: ['$status', 'Completed'] },
      { $eq: [{ $type: '$completionDate' }, 'date'] },
      { $lte: ['$completionDate', end] },
    ],
  };
  const inProgressDelayed = {
    $and: [started, { $not: [completedByEnd] }, { $eq: ['$status', 'Delayed'] }],
  };

  const rows = await ProjectStatus.aggregate([
    // ProjectStatus has no buildingProject ObjectId; exact name match is the only current mapping.
    ...(project ? [{ $match: { name: project.name } }] : []),
    {
      $group: {
        _id: null,
        totalProjects: { $sum: { $cond: [started, 1, 0] } },
        completedProjects: { $sum: { $cond: [completedByEnd, 1, 0] } },
        delayedProjects: { $sum: { $cond: [inProgressDelayed, 1, 0] } },
        // $avg skips nulls, so only projects completed by the end date count toward duration.
        avgDurationMs: {
          $avg: {
            $cond: [completedByEnd, { $subtract: ['$completionDate', '$startDate'] }, null],
          },
        },
      },
    },
  ]);

  // No ProjectStatus records at all means there is no source data, not a real zero.
  if (rows.length === 0) {
    return {
      totalProjects: null,
      completedProjects: null,
      activeProjects: null,
      delayedProjects: null,
      avgProjectDuration: null,
    };
  }

  const { totalProjects, completedProjects, delayedProjects, avgDurationMs } = rows[0];
  return {
    totalProjects,
    completedProjects,
    delayedProjects,
    activeProjects: totalProjects - completedProjects - delayedProjects,
    avgProjectDuration:
      avgDurationMs === null || avgDurationMs === undefined
        ? null
        : Math.round(avgDurationMs / HOUR_MS),
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

// Same source and filter as the Distribution of Labor Hours chart: completed BM time logs by createdAt.
async function getLaborHours(project, startDate, endDate) {
  const { start, end } = toDateRange(startDate, endDate);
  const match = {
    status: 'completed',
    totalElapsedTime: { $gt: 0 },
    createdAt: { $gte: start, $lte: end },
  };

  if (project) {
    match.project = project._id;
  }

  const rows = await BuildingTimeLog.aggregate([
    { $match: match },
    { $group: { _id: null, totalElapsedTime: { $sum: '$totalElapsedTime' } } },
  ]);

  return rows.length === 0 ? null : roundToTwoDecimals((rows[0].totalElapsedTime ?? 0) / HOUR_MS);
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
      const canProject = hasCosts && duration > 0 && elapsedShare > 0;
      if (!canProject) return sum;

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

function currentOnlyOrUnavailableMetric(value, reason, unit) {
  return value === null
    ? unavailableMetric(NO_PERIOD_DATA_REASON, unit)
    : currentOnlyMetric(value, reason, unit);
}

async function calculatePeriodMetrics({ project, startDate, endDate }) {
  const [projectStatus, materialStats, totalLaborCost, totalLaborHours] = await Promise.all([
    getProjectStatusAsOf(project, endDate),
    getMaterialStats(project, startDate, endDate),
    getLaborCost(project, startDate, endDate),
    getLaborHours(project, startDate, endDate),
  ]);

  return {
    totalProjects: comparableOrUnavailableMetric(projectStatus.totalProjects),
    completedProjects: comparableOrUnavailableMetric(projectStatus.completedProjects),
    delayedProjects: currentOnlyOrUnavailableMetric(
      projectStatus.delayedProjects,
      ACTIVE_DELAYED_CURRENT_ONLY_REASON,
    ),
    activeProjects: currentOnlyOrUnavailableMetric(
      projectStatus.activeProjects,
      ACTIVE_DELAYED_CURRENT_ONLY_REASON,
    ),
    avgProjectDuration: comparableOrUnavailableMetric(projectStatus.avgProjectDuration, 'hrs'),
    totalMaterialCost: comparableOrUnavailableMetric(materialStats.totalMaterialCost, 'USD'),
    totalMaterialUsed: comparableOrUnavailableMetric(materialStats.totalMaterialUsed),
    totalLaborHoursInvested: comparableOrUnavailableMetric(totalLaborHours, 'hrs'),
    totalLaborCost: comparableOrUnavailableMetric(totalLaborCost, 'USD'),
    materialAvailable: currentOnlyMetric(
      materialStats.materialAvailable,
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
    getLaborHours,
    getMaterialStats,
    getProjectStatusAsOf,
    sumKnownCosts,
  },
};
