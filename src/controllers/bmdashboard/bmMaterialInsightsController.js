/**
 * Material Insights Controller
 * Factory function that assembles handlers and utilities for material insights endpoints
 */

const createHandlers = require('./materialInsightsHandlers');
const {
  calculateMaterialInsights,
  calculateSummaryMetrics,
  calculateUsagePercentage,
  calculateStockRatio,
  getStockHealthStatus,
} = require('./materialInsightsCalculations');

const bmMaterialInsightsController = (BuildingMaterial) => {
  const handlers = createHandlers(BuildingMaterial);

  return {
    ...handlers,
    calculateMaterialInsights,
    calculateSummaryMetrics,
    calculateUsagePercentage,
    calculateStockRatio,
    getStockHealthStatus,
  };
};

module.exports = bmMaterialInsightsController;
