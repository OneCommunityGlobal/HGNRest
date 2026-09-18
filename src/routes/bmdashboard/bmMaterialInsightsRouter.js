/**
 * Material Insights Router
 * Provides API endpoints for Material Usage Insights & Visual Indicators feature
 * All endpoints return structured JSON with success flag, data, and timestamp
 */

const express = require('express');

const routes = function (BuildingMaterial) {
  const insightsRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmMaterialInsightsController')(
    BuildingMaterial,
  );

  /**
   * GET /materials/insights/all
   * Get insights for all materials with summary metrics
   * Response: { success, data: { materials[], summary{}, timestamp } }
   */
  insightsRouter.route('/insights/all').get(controller.getMaterialInsightsAll);

  /**
   * GET /materials/insights/summary
   * Get summary metrics for all materials (lightweight)
   * Response: { success, data: { totalMaterials, lowStockCount, lowStockPercentage, ... } }
   */
  insightsRouter.route('/insights/summary').get(controller.getSummaryMetrics);

  /**
   * GET /materials/insights/by-project/:projectId
   * Get insights for materials in a specific project
   * Response: { success, data: { projectId, materials[], summary{}, timestamp } }
   */
  insightsRouter
    .route('/insights/by-project/:projectId')
    .get(controller.getMaterialInsightsByProject);

  /**
   * GET /materials/insights/summary/by-project/:projectId
   * Get summary metrics for a specific project
   * Response: { success, data: { projectId, totalMaterials, lowStockCount, ... } }
   */
  insightsRouter
    .route('/insights/summary/by-project/:projectId')
    .get(controller.getSummaryMetricsByProject);

  /**
   * GET /materials/insights/critical-items
   * Get all materials with critical/low stock levels
   * Response: { success, data: { criticalItemCount, items[], timestamp } }
   */
  insightsRouter.route('/insights/critical-items').get(controller.getCriticalStockItems);

  /**
   * GET /materials/insights/high-usage-items
   * Get all materials with high usage (>= 80%)
   * Response: { success, data: { highUsageItemCount, items[], timestamp } }
   */
  insightsRouter.route('/insights/high-usage-items').get(controller.getHighUsageItems);

  /**
   * GET /materials/insights/:materialId
   * Get detailed insights for a specific material
   * Response: { success, data: { materialId, materialName, unit, projectId, ... } }
   */
  insightsRouter.route('/insights/:materialId').get(controller.getMaterialInsightsDetail);

  return insightsRouter;
};

module.exports = routes;
