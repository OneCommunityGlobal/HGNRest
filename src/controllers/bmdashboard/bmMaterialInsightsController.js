/**
 * Material Insights Controller
 * Provides backend calculations and endpoints for Material Usage Insights feature
 * Mirrors frontend calculations from materialInsights.js utility
 */

const mongoose = require('mongoose');

const bmMaterialInsightsController = function (BuildingMaterial) {
  /**
   * Format a number to specified decimal places
   * Handles floating point precision issues
   * @param {number} value - The value to format
   * @param {number} decimals - Number of decimal places (default: 2)
   * @returns {number|null} Formatted number or null
   */
  const formatNumber = (value, decimals = 2) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null;
    }
    return Math.round(value * 10 ** decimals) / 10 ** decimals;
  };

  /**
   * Calculate usage percentage (Used / Bought)
   * @param {number} used - Amount used
   * @param {number} bought - Amount bought
   * @returns {number|null} Usage percentage or null if bought is 0
   */
  const calculateUsagePercentage = (used, bought) => {
    if (!bought || bought <= 0) {
      return null;
    }
    const percentage = (used / bought) * 100;
    return formatNumber(percentage, 2);
  };

  /**
   * Calculate stock ratio (Available / Bought)
   * @param {number} available - Amount available
   * @param {number} bought - Amount bought
   * @returns {number|null} Stock ratio (0-1) or null if bought is 0
   */
  const calculateStockRatio = (available, bought) => {
    if (!bought || bought <= 0) {
      return null;
    }
    const ratio = available / bought;
    return formatNumber(ratio, 2);
  };

  /**
   * Get stock health status based on stock ratio
   * Thresholds:
   * - critical: <= 20% stock remaining
   * - low: 20-40% stock remaining
   * - healthy: > 40% stock remaining
   * @param {number} stockRatio - The stock ratio (0-1)
   * @returns {string} Health status: 'healthy', 'low', 'critical', or 'no-data'
   */
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

  /**
   * Get stock health color for UI display
   * @param {string} status - Stock health status
   * @returns {string} Color code: 'green', 'yellow', 'red', or 'gray'
   */
  const getStockHealthColor = (status) => {
    const colorMap = {
      healthy: 'green',
      low: 'yellow',
      critical: 'red',
    };
    return colorMap[status] || 'gray';
  };

  /**
   * Get stock health label for UI display
   * @param {string} status - Stock health status
   * @returns {string} Display label
   */
  const getStockHealthLabel = (status) => {
    const labelMap = {
      healthy: 'Healthy',
      low: 'Low',
      critical: 'Critical',
    };
    return labelMap[status] || 'No Data';
  };

  /**
   * Calculate all insights for a single material
   * @param {object} material - Material document
   * @returns {object} Insights object with all calculated values
   */
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

  /**
   * Calculate summary metrics from a list of materials
   * @param {array} materials - Array of material documents
   * @returns {object} Summary metrics for dashboard
   */
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

      // Count low/critical stock
      if (insights.stockHealth === 'low' || insights.stockHealth === 'critical') {
        lowStockCount += 1;
      }

      // Count over usage threshold (default 80%)
      if (insights.usagePct !== null && insights.usagePct >= 80) {
        overUsageCount += 1;
      }

      // Count items on hold
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

  /**
   * GET /materials/insights/all
   * Get insights for all materials with summary metrics
   */
  const getMaterialInsightsAll = async (req, res) => {
    try {
      const materials = await BuildingMaterial.find()
        .populate([
          { path: 'project', select: '_id name' },
          { path: 'itemType', select: '_id name unit' },
        ])
        .lean()
        .exec();

      const materialInsights = materials.map((material) => calculateMaterialInsights(material));

      const summaryMetrics = calculateSummaryMetrics(materials);

      return res.status(200).json({
        success: true,
        data: {
          materials: materialInsights,
          summary: summaryMetrics,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching material insights:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  };

  /**
   * GET /materials/insights/by-project/:projectId
   * Get insights for materials in a specific project
   */
  const getMaterialInsightsByProject = async (req, res) => {
    try {
      const { projectId } = req.params;

      // Validate project ID
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid project ID',
        });
      }

      const materials = await BuildingMaterial.find({ project: projectId })
        .populate([
          { path: 'project', select: '_id name' },
          { path: 'itemType', select: '_id name unit' },
        ])
        .lean()
        .exec();

      const materialInsights = materials.map((material) => calculateMaterialInsights(material));

      const summaryMetrics = calculateSummaryMetrics(materials);

      return res.status(200).json({
        success: true,
        data: {
          projectId,
          materials: materialInsights,
          summary: summaryMetrics,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching material insights by project:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  };

  /**
   * GET /materials/insights/summary
   * Get summary metrics for all materials (lightweight endpoint)
   */
  const getSummaryMetrics = async (req, res) => {
    try {
      const materials = await BuildingMaterial.find().lean().exec();

      const summaryMetrics = calculateSummaryMetrics(materials);

      return res.status(200).json({
        success: true,
        data: {
          ...summaryMetrics,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching summary metrics:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  };

  /**
   * GET /materials/insights/summary/by-project/:projectId
   * Get summary metrics for a specific project
   */
  const getSummaryMetricsByProject = async (req, res) => {
    try {
      const { projectId } = req.params;

      // Validate project ID
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid project ID',
        });
      }

      const materials = await BuildingMaterial.find({ project: projectId }).lean().exec();

      const summaryMetrics = calculateSummaryMetrics(materials);

      return res.status(200).json({
        success: true,
        data: {
          projectId,
          ...summaryMetrics,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching summary metrics by project:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  };

  /**
   * GET /materials/insights/critical-items
   * Get all materials with critical stock levels across all projects
   */
  const getCriticalStockItems = async (req, res) => {
    try {
      const materials = await BuildingMaterial.find()
        .populate([
          { path: 'project', select: '_id name' },
          { path: 'itemType', select: '_id name unit' },
        ])
        .lean()
        .exec();

      const criticalItems = materials
        .map((material) => calculateMaterialInsights(material))
        .filter((insight) => insight.stockHealth === 'critical' || insight.stockHealth === 'low')
        .sort((a, b) => {
          // Sort by stock ratio (lowest first)
          if (a.stockRatio === null) return 1;
          if (b.stockRatio === null) return -1;
          return a.stockRatio - b.stockRatio;
        });

      return res.status(200).json({
        success: true,
        data: {
          criticalItemCount: criticalItems.length,
          items: criticalItems,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching critical stock items:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  };

  /**
   * GET /materials/insights/high-usage-items
   * Get all materials with high usage (>= 80%) across all projects
   */
  const getHighUsageItems = async (req, res) => {
    try {
      const materials = await BuildingMaterial.find()
        .populate([
          { path: 'project', select: '_id name' },
          { path: 'itemType', select: '_id name unit' },
        ])
        .lean()
        .exec();

      const highUsageItems = materials
        .map((material) => calculateMaterialInsights(material))
        .filter((insight) => insight.usagePct !== null && insight.usagePct >= 80)
        .sort(
          (a, b) =>
            // Sort by usage percentage (highest first)
            (b.usagePct || 0) - (a.usagePct || 0),
        );

      return res.status(200).json({
        success: true,
        data: {
          highUsageItemCount: highUsageItems.length,
          items: highUsageItems,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching high usage items:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  };

  /**
   * GET /materials/insights/:materialId
   * Get detailed insights for a specific material
   */
  const getMaterialInsightsDetail = async (req, res) => {
    try {
      const { materialId } = req.params;

      // Validate material ID
      if (!mongoose.Types.ObjectId.isValid(materialId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid material ID',
        });
      }

      const material = await BuildingMaterial.findById(materialId)
        .populate([
          { path: 'project', select: '_id name' },
          { path: 'itemType', select: '_id name unit' },
        ])
        .lean()
        .exec();

      if (!material) {
        return res.status(404).json({
          success: false,
          message: 'Material not found',
        });
      }

      const insights = calculateMaterialInsights(material);

      return res.status(200).json({
        success: true,
        data: {
          ...insights,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching material insights detail:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  };

  // Export all functions
  return {
    getMaterialInsightsAll,
    getMaterialInsightsByProject,
    getSummaryMetrics,
    getSummaryMetricsByProject,
    getCriticalStockItems,
    getHighUsageItems,
    getMaterialInsightsDetail,
    // Export calculation functions for testing
    calculateMaterialInsights,
    calculateSummaryMetrics,
    calculateUsagePercentage,
    calculateStockRatio,
    getStockHealthStatus,
  };
};

module.exports = bmMaterialInsightsController;
