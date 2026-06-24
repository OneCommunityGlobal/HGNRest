/**
 * Material Insights Calculations
 * Pure calculation functions for material insights
 */

const formatNumber = (value, decimals = 2) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
};

const calculateUsagePercentage = (used, bought) => {
  if (!bought || bought <= 0) {
    return null;
  }
  const percentage = (used / bought) * 100;
  return formatNumber(percentage, 2);
};

const calculateStockRatio = (available, bought) => {
  if (!bought || bought <= 0) {
    return null;
  }
  const ratio = available / bought;
  return formatNumber(ratio, 2);
};

const getStockHealthStatus = (stockRatio) => {
  if (stockRatio === null || stockRatio === undefined) {
    return 'no-data';
  }
  if (stockRatio <= 0.2) {
    return 'critical';
  }
  if (stockRatio <= 0.4) {
    return 'low';
  }
  return 'healthy';
};

const getStockHealthColor = (status) => {
  const colorMap = {
    healthy: 'green',
    low: 'yellow',
    critical: 'red',
  };
  return colorMap[status] || 'gray';
};

const getStockHealthLabel = (status) => {
  const labelMap = {
    healthy: 'Healthy',
    low: 'Low',
    critical: 'Critical',
  };
  return labelMap[status] || 'No Data';
};

const calculateMaterialInsights = (material) => {
  const bought = material?.stockBought || 0;
  const used = material?.stockUsed || 0;
  const available = material?.stockAvailable || 0;
  const wasted = material?.stockWasted || 0;
  const hold = material?.stockHold || 0;

  const usagePct = calculateUsagePercentage(used, bought);
  const stockRatio = calculateStockRatio(available, bought);
  const stockHealth = getStockHealthStatus(stockRatio);
  const stockHealthColor = getStockHealthColor(stockHealth);
  const stockHealthLabel = getStockHealthLabel(stockHealth);

  return {
    materialId: material._id?.toString(),
    materialName: material.itemType?.name || 'Unknown',
    unit: material.itemType?.unit || '',
    projectId: material.project?._id?.toString(),
    projectName: material.project?.name || 'Unknown',
    bought,
    used,
    available,
    wasted,
    hold,
    usagePct,
    stockRatio,
    stockHealth,
    stockHealthColor,
    stockHealthLabel,
    hasBoughtData: bought > 0,
  };
};

const calculateSummaryMetrics = (materials) => {
  if (!materials || materials.length === 0) {
    return {
      totalMaterials: 0,
      lowStockCount: 0,
      lowStockPercentage: 0,
      overUsageCount: 0,
      overUsagePercentage: 0,
      onHoldCount: 0,
      usageThreshold: 80,
    };
  }

  const total = materials.length;
  let lowStockCount = 0;
  let overUsageCount = 0;
  let onHoldCount = 0;

  materials.forEach((material) => {
    const insights = calculateMaterialInsights(material);

    if (insights.stockHealth === 'low' || insights.stockHealth === 'critical') {
      lowStockCount += 1;
    }

    if (insights.usagePct !== null && insights.usagePct >= 80) {
      overUsageCount += 1;
    }

    if ((material?.stockHold || 0) > 0) {
      onHoldCount += 1;
    }
  });

  const lowStockPercentage = formatNumber((lowStockCount / total) * 100, 1);
  const overUsagePercentage = formatNumber((overUsageCount / total) * 100, 1);

  return {
    totalMaterials: total,
    lowStockCount,
    lowStockPercentage,
    overUsageCount,
    overUsagePercentage,
    onHoldCount,
    usageThreshold: 80,
  };
};

module.exports = {
  formatNumber,
  calculateUsagePercentage,
  calculateStockRatio,
  getStockHealthStatus,
  getStockHealthColor,
  getStockHealthLabel,
  calculateMaterialInsights,
  calculateSummaryMetrics,
};
