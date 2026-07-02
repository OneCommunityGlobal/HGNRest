const mongoose = require('mongoose');
const regression = require('regression');
const ProjectRiskProfile = require('../models/bmdashboard/projectRiskProfile');
const cache = require('../utilities/nodeCache')();
const {
  UTILIZATION_THRESHOLDS,
  UTILIZATION_LABELS,
  TRAFFIC_LIGHT,
  FORECAST_MODES,
  MAINTENANCE_TRIGGER_THRESHOLD,
  MINIMUM_WEEKS_FOR_REGRESSION,
  FORECAST_DEFAULT_DAYS,
  HOURS_PER_DAY,
  DAYS_PER_WEEK,
  MS_PER_HOUR,
  DEGRADED_CONDITIONS,
  NON_OPERATIONAL_STATUSES,
  CONFIDENCE_THRESHOLDS,
  ENSEMBLE_WEIGHTS,
  EMA_SMOOTHING_BASE,
  ROUNDING_PRECISION,
} = require('../constants/toolUtilization');

// ─── classifyUtilization ───
const classifyUtilization = (rate) => {
  if (rate < UTILIZATION_THRESHOLDS.UNDER_UTILIZED_MAX) {
    return { label: UTILIZATION_LABELS.UNDER, trafficLight: TRAFFIC_LIGHT.YELLOW };
  }
  if (rate <= UTILIZATION_THRESHOLDS.NORMAL_MAX) {
    return { label: UTILIZATION_LABELS.NORMAL, trafficLight: TRAFFIC_LIGHT.GREEN };
  }
  return { label: UTILIZATION_LABELS.OVER, trafficLight: TRAFFIC_LIGHT.RED };
};

// ─── calculateCheckedOutHours ───
const calculateCheckedOutHours = (toolItem, periodStart, periodEnd) => {
  const periodHours = (periodEnd - periodStart) / MS_PER_HOUR;
  const relevantLogs = (toolItem.logRecord || []).filter((log) => {
    const logDate = new Date(log.date);
    return logDate >= periodStart && logDate <= periodEnd;
  });

  relevantLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

  let checkedOutTime = 0;
  let lastCheckOut = null;

  relevantLogs.forEach((log) => {
    if (log.type === 'Check Out') {
      lastCheckOut = new Date(log.date);
    } else if (log.type === 'Check In' && lastCheckOut) {
      const hoursOut = (new Date(log.date) - lastCheckOut) / MS_PER_HOUR;
      checkedOutTime += Math.max(0, hoursOut);
      lastCheckOut = null;
    }
  });

  if (lastCheckOut) {
    checkedOutTime += Math.max(0, (periodEnd - lastCheckOut) / MS_PER_HOUR);
  }

  if (relevantLogs.length === 0 && toolItem.logRecord && toolItem.logRecord.length > 0) {
    const sortedAllLogs = [...toolItem.logRecord].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
    const lastLog = sortedAllLogs[0];
    if (lastLog?.type === 'Check Out' && new Date(lastLog.date) < periodStart) {
      checkedOutTime = periodHours;
    }
  }

  return checkedOutTime;
};

// ─── buildToolFilter ───
const buildToolFilter = (query) => {
  const filter = { __t: 'tool_item' };
  if (query.tool && query.tool !== 'ALL' && mongoose.Types.ObjectId.isValid(query.tool)) {
    filter.itemType = mongoose.Types.ObjectId(query.tool);
  }
  if (query.project && query.project !== 'ALL' && mongoose.Types.ObjectId.isValid(query.project)) {
    filter.project = mongoose.Types.ObjectId(query.project);
  }
  return filter;
};

// ─── parseDateRange ───
const parseDateRange = (startDate, endDate) => {
  const rangeEnd = endDate ? new Date(endDate) : new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - FORECAST_DEFAULT_DAYS);
  const rangeStart = startDate ? new Date(startDate) : defaultStart;
  const totalHours = (rangeEnd - rangeStart) / MS_PER_HOUR;
  return { rangeStart, rangeEnd, totalHours };
};

// ─── groupToolsByType ───
const groupToolsByType = (tools) => {
  const toolGroups = {};
  tools.forEach((toolItem) => {
    if (!toolItem.itemType) return;
    const toolTypeId = toolItem.itemType._id.toString();
    if (!toolGroups[toolTypeId]) {
      toolGroups[toolTypeId] = {
        name: toolItem.itemType.name || 'Unknown Tool',
        tools: [],
      };
    }
    toolGroups[toolTypeId].tools.push(toolItem);
  });
  return toolGroups;
};

// ─── calculateGroupUtilization ───
const calculateGroupUtilization = (group, rangeStart, rangeEnd, totalHours) => {
  let totalCheckedOut = 0;
  const purchaseStatuses = [];
  const conditions = [];
  const currentUsages = [];

  group.tools.forEach((toolItem) => {
    totalCheckedOut += calculateCheckedOutHours(toolItem, rangeStart, rangeEnd);
    if (toolItem.purchaseStatus) purchaseStatuses.push(toolItem.purchaseStatus);
    if (toolItem.condition) conditions.push(toolItem.condition);
    if (toolItem.currentUsage) currentUsages.push(toolItem.currentUsage);
  });

  const toolCount = group.tools.length;
  const totalPossibleHours = totalHours * toolCount;
  const utilizationRate =
    totalPossibleHours > 0 ? Math.round((totalCheckedOut / totalPossibleHours) * 100) : 0;
  const downtime =
    Math.round((totalPossibleHours - totalCheckedOut) * ROUNDING_PRECISION) / ROUNDING_PRECISION;

  return {
    name: group.name,
    utilizationRate,
    downtime,
    classification: classifyUtilization(utilizationRate),
    toolCount,
    totalCheckedOutHours: Math.round(totalCheckedOut * ROUNDING_PRECISION) / ROUNDING_PRECISION,
    totalPossibleHours: Math.round(totalPossibleHours * ROUNDING_PRECISION) / ROUNDING_PRECISION,
    toolGroupDetails: {
      tools: group.tools,
      purchaseStatuses,
      conditions,
      currentUsages,
    },
  };
};

// ─── buildCacheKey ───
const buildCacheKey = (query) =>
  `toolUtil:${query.tool || 'ALL'}:${query.project || 'ALL'}:${query.startDate || 'default'}:${query.endDate || 'default'}`;

// ─── computeUtilizationData ───
const computeUtilizationData = async (BuildingTool, query) => {
  const cacheKey = buildCacheKey(query);
  if (cache.hasCache(cacheKey)) {
    return cache.getCache(cacheKey);
  }

  const filter = buildToolFilter(query);
  const tools = await BuildingTool.find(filter)
    .populate('itemType', 'name')
    .populate('project', 'name')
    .lean();

  const { rangeStart, rangeEnd, totalHours } = parseDateRange(query.startDate, query.endDate);
  const toolGroups = groupToolsByType(tools);
  const utilizationData = Object.values(toolGroups)
    .map((group) => calculateGroupUtilization(group, rangeStart, rangeEnd, totalHours))
    .sort((a, b) => b.utilizationRate - a.utilizationRate);

  const result = { toolGroups, utilizationData, rangeStart, rangeEnd, totalHours };
  cache.setCache(cacheKey, result);
  return result;
};

// ─── bucketUtilizationByWeek ───
const bucketUtilizationByWeek = (toolGroup, rangeStart, rangeEnd) => {
  const rangeDuration = rangeEnd.getTime() - rangeStart.getTime();
  const weekMs = DAYS_PER_WEEK * HOURS_PER_DAY * MS_PER_HOUR;
  const numWeeks = Math.max(1, Math.ceil(rangeDuration / weekMs));
  const buckets = [];

  for (let i = 0; i < numWeeks; i += 1) {
    const weekStart = new Date(rangeStart.getTime() + i * weekMs);
    const weekEnd = new Date(Math.min(weekStart.getTime() + weekMs, rangeEnd.getTime()));
    const weekHours = (weekEnd - weekStart) / MS_PER_HOUR;

    let weekCheckedOut = 0;
    toolGroup.tools.forEach((toolItem) => {
      weekCheckedOut += calculateCheckedOutHours(toolItem, weekStart, weekEnd);
    });

    const weekTotalPossible = weekHours * toolGroup.tools.length;
    const weekRate =
      weekTotalPossible > 0 ? Math.round((weekCheckedOut / weekTotalPossible) * 100) : 0;

    buckets.push({ weekIndex: i, weekStart, weekEnd, utilizationRate: weekRate });
  }

  return buckets;
};

// ─── computeEnsemblePredictions (internal helper for forecastUtilization) ───
const computeEnsemblePredictions = (weeklyBuckets, forecastWeeks, weekMs, existingWeeks) => {
  const data = weeklyBuckets.map((b, i) => [i, b.utilizationRate]);
  const result = regression.linear(data);
  const r2 = result.r2 || 0;

  let emaValue = weeklyBuckets[0].utilizationRate;
  const alpha = EMA_SMOOTHING_BASE / (existingWeeks + 1);
  for (let i = 1; i < existingWeeks; i += 1) {
    emaValue = alpha * weeklyBuckets[i].utilizationRate + (1 - alpha) * emaValue;
  }

  let weights;
  let confidence = 'low';
  if (r2 >= CONFIDENCE_THRESHOLDS.HIGH) {
    weights = ENSEMBLE_WEIGHTS.HIGH_R2;
    confidence = 'high';
  } else if (r2 >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    weights = ENSEMBLE_WEIGHTS.MEDIUM_R2;
    confidence = 'medium';
  } else {
    weights = ENSEMBLE_WEIGHTS.LOW_R2;
  }

  const weeklyPredictions = [];
  for (let j = 0; j < forecastWeeks; j += 1) {
    const futureIndex = existingWeeks + j;
    const regressionPred = result.predict(futureIndex)[1];
    const blended = weights.regression * regressionPred + weights.ema * emaValue;
    const clamped = Math.min(100, Math.max(0, Math.round(blended)));

    const weekStart = new Date(Date.now() + j * weekMs);
    const weekEnd = new Date(weekStart.getTime() + weekMs);
    weeklyPredictions.push({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      predictedRate: clamped,
    });
  }

  return { weeklyPredictions, confidence };
};

// ─── forecastUtilization (ensemble: regression + EMA) ───
const forecastUtilization = (weeklyBuckets, forecastDays) => {
  const weekMs = DAYS_PER_WEEK * HOURS_PER_DAY * MS_PER_HOUR;
  const forecastWeeks = Math.max(1, Math.ceil(forecastDays / DAYS_PER_WEEK));
  const existingWeeks = weeklyBuckets.length;
  let weeklyPredictions;
  let confidence = 'low';
  let method = 'average';

  if (existingWeeks < MINIMUM_WEEKS_FOR_REGRESSION) {
    const avgRate =
      existingWeeks > 0
        ? Math.round(weeklyBuckets.reduce((sum, b) => sum + b.utilizationRate, 0) / existingWeeks)
        : 0;

    weeklyPredictions = [];
    for (let j = 0; j < forecastWeeks; j += 1) {
      const weekStart = new Date(Date.now() + j * weekMs);
      const weekEnd = new Date(weekStart.getTime() + weekMs);
      weeklyPredictions.push({
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        predictedRate: avgRate,
      });
    }
  } else {
    const ensemble = computeEnsemblePredictions(
      weeklyBuckets,
      forecastWeeks,
      weekMs,
      existingWeeks,
    );
    weeklyPredictions = ensemble.weeklyPredictions;
    confidence = ensemble.confidence;
    method = 'ensemble';
  }

  const predictedRate =
    weeklyPredictions.length > 0
      ? Math.round(
          weeklyPredictions.reduce((sum, w) => sum + w.predictedRate, 0) / weeklyPredictions.length,
        )
      : 0;

  const forecastEndDate = new Date(
    Date.now() + forecastDays * HOURS_PER_DAY * MS_PER_HOUR,
  ).toISOString();

  return {
    predictedRate,
    confidence,
    forecastEndDate,
    weeklyPredictions,
    predictedClassification: classifyUtilization(predictedRate),
    method,
  };
};

// ─── generateMaintenanceAlerts ───
const generateMaintenanceAlerts = (utilizationData) => {
  const alerts = [];

  utilizationData.forEach((item) => {
    const { toolGroupDetails } = item;

    if (item.utilizationRate > MAINTENANCE_TRIGGER_THRESHOLD) {
      alerts.push({
        toolName: item.name,
        alertType: 'overuse',
        message: `High utilization at ${item.utilizationRate}%. Schedule preventive maintenance.`,
        urgency: 'high',
      });
    }

    const degradedSet = new Set();
    toolGroupDetails.conditions.forEach((condition) => {
      if (DEGRADED_CONDITIONS.includes(condition) && !degradedSet.has(condition)) {
        degradedSet.add(condition);
        alerts.push({
          toolName: item.name,
          alertType: 'condition',
          message: `Tool condition is ${condition}. Immediate maintenance recommended.`,
          urgency: 'high',
        });
      }
    });

    const nonOpCounts = {};
    toolGroupDetails.currentUsages.forEach((usage) => {
      if (NON_OPERATIONAL_STATUSES.includes(usage)) {
        nonOpCounts[usage] = (nonOpCounts[usage] || 0) + 1;
      }
    });
    Object.entries(nonOpCounts).forEach(([status, count]) => {
      alerts.push({
        toolName: item.name,
        alertType: 'non_operational',
        message: `${count} unit(s) currently ${status}. Effective fleet capacity reduced.`,
        urgency: 'medium',
      });
    });
  });

  return alerts;
};

// ─── generateResourceBalancingSuggestions ───
const generateResourceBalancingSuggestions = (utilizationData) => {
  const suggestions = [];
  const overUtilized = utilizationData.filter(
    (d) => d.utilizationRate > UTILIZATION_THRESHOLDS.NORMAL_MAX,
  );
  const underUtilized = utilizationData.filter(
    (d) => d.utilizationRate < UTILIZATION_THRESHOLDS.UNDER_UTILIZED_MAX,
  );

  const sortedUnder = [...underUtilized].sort((a, b) => a.utilizationRate - b.utilizationRate);

  overUtilized.forEach((overTool) => {
    if (sortedUnder.length > 0) {
      const leastUsed = sortedUnder[0];
      suggestions.push({
        suggestion: 'Consider redistributing workload.',
        fromTool: overTool.name,
        toTool: leastUsed.name,
        rationale: `${overTool.name} is at ${overTool.utilizationRate}% while ${leastUsed.name} is at ${leastUsed.utilizationRate}%.`,
      });
    }

    const rentalCount = overTool.toolGroupDetails.purchaseStatuses.filter(
      (s) => s === 'Rental',
    ).length;
    if (rentalCount > overTool.toolCount / 2) {
      suggestions.push({
        suggestion: 'Consider purchasing additional units to reduce rental dependency.',
        fromTool: overTool.name,
        toTool: null,
        rationale: `${overTool.name} is over-utilized at ${overTool.utilizationRate}% and predominantly rented.`,
      });
    }
  });

  underUtilized.forEach((underTool) => {
    const purchasedCount = underTool.toolGroupDetails.purchaseStatuses.filter(
      (s) => s === 'Purchased',
    ).length;
    if (purchasedCount > underTool.toolCount / 2) {
      suggestions.push({
        suggestion: 'Consider renting instead of owning, or reassign to other projects.',
        fromTool: underTool.name,
        toTool: null,
        rationale: `${underTool.name} is under-utilized at ${underTool.utilizationRate}% and predominantly owned.`,
      });
    }
  });

  return suggestions;
};

// ─── generateRecommendations ───
const generateRecommendations = (utilizationData) =>
  utilizationData.map((item) => {
    let action;
    if (item.classification.label === UTILIZATION_LABELS.UNDER) {
      action = 'Potentially removable or rentable instead of owned. Review necessity.';
    } else if (item.classification.label === UTILIZATION_LABELS.OVER) {
      action = 'Requires maintenance scheduling, backup inventory, or purchase planning.';
    } else {
      action = 'Normal operation. No action required.';
    }

    return {
      toolName: item.name,
      utilizationRate: item.utilizationRate,
      label: item.classification.label,
      trafficLight: item.classification.trafficLight,
      action,
    };
  });

// ─── stripInternalDetails ───
const stripInternalDetails = (item) => {
  const { toolGroupDetails: _toolGroupDetails, ...publicFields } = item;
  return publicFields;
};

// ─── buildInsightsSummary ───
const buildInsightsSummary = (utilizationData) => {
  const totalToolTypes = utilizationData.length;
  const underCount = utilizationData.filter(
    (d) => d.classification.label === UTILIZATION_LABELS.UNDER,
  ).length;
  const overCount = utilizationData.filter(
    (d) => d.classification.label === UTILIZATION_LABELS.OVER,
  ).length;
  const normalCount = totalToolTypes - underCount - overCount;
  const averageUtilization =
    totalToolTypes > 0
      ? Math.round(utilizationData.reduce((s, d) => s + d.utilizationRate, 0) / totalToolTypes)
      : 0;

  return {
    totalToolTypes,
    underUtilized: underCount,
    normal: normalCount,
    overUtilized: overCount,
    averageUtilization,
  };
};

// ─── determineForecastDays ───
const determineForecastDays = async (mode, projectId) => {
  if (mode === FORECAST_MODES.FORECAST_30) {
    return { forecastDays: FORECAST_DEFAULT_DAYS, warning: null };
  }

  if (!projectId || projectId === 'ALL') {
    return {
      forecastDays: FORECAST_DEFAULT_DAYS,
      warning: 'No specific project selected. Defaulting to 30-day forecast.',
    };
  }

  const riskProfile = await ProjectRiskProfile.findOne({
    projectId: mongoose.Types.ObjectId(projectId),
  }).lean();

  if (!riskProfile?.endDate) {
    return {
      forecastDays: FORECAST_DEFAULT_DAYS,
      warning: 'No project schedule found. Defaulting to 30-day forecast.',
    };
  }

  const daysToEnd = Math.ceil(
    (new Date(riskProfile.endDate) - Date.now()) / (HOURS_PER_DAY * MS_PER_HOUR),
  );
  return {
    forecastDays: Math.max(DAYS_PER_WEEK, daysToEnd),
    warning: null,
  };
};

// ─── buildUtilizationResponse ───
const buildUtilizationResponse = async ({
  utilizationData,
  rangeStart,
  rangeEnd,
  selectedMode,
  project,
}) => {
  let warning = null;

  const responseData = await Promise.all(
    utilizationData.map(async (item) => {
      const publicItem = stripInternalDetails(item);
      publicItem.forecast = null;

      if (selectedMode !== FORECAST_MODES.HISTORICAL) {
        const { forecastDays, warning: fw } = await determineForecastDays(selectedMode, project);
        if (fw) warning = fw;

        const weeklyBuckets = bucketUtilizationByWeek(item.toolGroupDetails, rangeStart, rangeEnd);
        publicItem.forecast = forecastUtilization(weeklyBuckets, forecastDays);
      }

      return publicItem;
    }),
  );

  if (warning) {
    responseData.forEach((item) => {
      item.warning = warning;
    });
  }

  return responseData;
};

// ─── buildReportPayload ───
const buildReportPayload = (utilizationData, rangeStart, rangeEnd, project) => ({
  utilizationData,
  alerts: generateMaintenanceAlerts(utilizationData),
  balancing: generateResourceBalancingSuggestions(utilizationData),
  recommendations: generateRecommendations(utilizationData),
  summary: buildInsightsSummary(utilizationData),
  metadata: {
    generatedDate: new Date().toLocaleString(),
    dateRange: `${rangeStart.toISOString()} to ${rangeEnd.toISOString()}`,
    projectFilter: project || 'ALL',
  },
});

module.exports = {
  classifyUtilization,
  calculateCheckedOutHours,
  buildToolFilter,
  parseDateRange,
  groupToolsByType,
  calculateGroupUtilization,
  buildCacheKey,
  computeUtilizationData,
  bucketUtilizationByWeek,
  forecastUtilization,
  generateMaintenanceAlerts,
  generateResourceBalancingSuggestions,
  generateRecommendations,
  stripInternalDetails,
  buildInsightsSummary,
  determineForecastDays,
  buildUtilizationResponse,
  buildReportPayload,
};
